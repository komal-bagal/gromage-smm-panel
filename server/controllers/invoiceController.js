const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Order = require("../models/Order");
const PaymentTransaction = require("../models/PaymentTransaction");
const Setting = require("../models/Setting");

// ======================================================
// HELPERS
// ======================================================

const roundAmount = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
};

const getRequestId = (req) => {
  return req.requestId || req.headers["x-request-id"] || null;
};

const safeServerError = (req, res, logMessage, error) => {
  console.error(logMessage, error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    requestId: getRequestId(req)
  });
};

const isAdminOrStaff = (req) => {
  return (
    req.user &&
    ["admin", "staff"].includes(req.user.role)
  );
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const escapeRegex = (value) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const sanitizeFileName = (value) => {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 150);
};

const getInvoiceSettings = async () => {
  let settings = await Setting.findOne({
    key: "payment"
  });

  if (!settings) {
    settings = await Setting.create({
      key: "payment"
    });
  }

  return settings.invoice || {};
};

// ======================================================
// GENERATE INVOICE NUMBER
// ======================================================

const generateInvoiceNumber = async () => {
  const invoiceSettings = await getInvoiceSettings();

  const rawPrefix =
    invoiceSettings.invoicePrefix || "INV";

  const prefix =
    String(rawPrefix)
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 20) || "INV";

  const startingNumber =
    Number(invoiceSettings.invoiceNumberStart) || 1;

  const safePrefix =
    escapeRegex(prefix);

  const lastInvoice =
    await Invoice.findOne({
      invoiceNumber: {
        $regex: `^${safePrefix}-`
      }
    })
      .sort({
        createdAt: -1
      })
      .select("invoiceNumber");

  let nextNumber = startingNumber;

  if (
    lastInvoice &&
    lastInvoice.invoiceNumber
  ) {
    const match =
      lastInvoice.invoiceNumber.match(
        new RegExp(
          `^${safePrefix}-(\\d+)$`
        )
      );

    if (match) {
      nextNumber =
        Number(match[1]) + 1;
    }
  }

  return `${prefix}-${String(
    nextNumber
  ).padStart(6, "0")}`;
};

// ======================================================
// CALCULATE GST
// ======================================================

const calculateGST = ({
  taxableAmount,
  gstRate,
  sameState = true
}) => {
  const taxable =
    roundAmount(taxableAmount);

  const rate =
    Number(gstRate) || 0;

  if (rate <= 0) {
    return {
      gstRate: 0,

      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,

      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,

      totalGstAmount: 0,

      totalAmount:
        taxable
    };
  }

  if (sameState) {
    const halfRate =
      rate / 2;

    const cgstAmount =
      roundAmount(
        (taxable * halfRate) / 100
      );

    const sgstAmount =
      roundAmount(
        (taxable * halfRate) / 100
      );

    return {
      gstRate: rate,

      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0,

      cgstAmount,
      sgstAmount,

      igstAmount: 0,

      totalGstAmount:
        roundAmount(
          cgstAmount + sgstAmount
        ),

      totalAmount:
        roundAmount(
          taxable +
          cgstAmount +
          sgstAmount
        )
    };
  }

  const igstAmount =
    roundAmount(
      (taxable * rate) / 100
    );

  return {
    gstRate: rate,

    cgstRate: 0,
    sgstRate: 0,
    igstRate: rate,

    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount,

    totalGstAmount:
      igstAmount,

    totalAmount:
      roundAmount(
        taxable + igstAmount
      )
  };
};

// ======================================================
// CREATE ORDER INVOICE
// ======================================================

const createOrderInvoice = async (req, res) => {
  try {
    const { orderId } =
      req.body || {};

    // --------------------------------------------------
    // VALIDATE ORDER ID
    // --------------------------------------------------

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    // --------------------------------------------------
    // FIND ORDER
    // --------------------------------------------------

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // --------------------------------------------------
    // ACCESS CHECK
    // --------------------------------------------------

    const adminOrStaff =
      isAdminOrStaff(req);

    if (
      !adminOrStaff &&
      String(order.userId) !==
        String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to create an invoice for this order"
      });
    }

    // --------------------------------------------------
    // CHECK EXISTING INVOICE
    // --------------------------------------------------

    const existingInvoice =
      await Invoice.findOne({
        orderId: order._id,
        invoiceType: "order"
      });

    if (existingInvoice) {
      return res.status(200).json({
        success: true,
        message: "Invoice already exists",
        invoice: existingInvoice
      });
    }

    // --------------------------------------------------
    // FIND USER
    // --------------------------------------------------

    const user =
      await User.findById(
        order.userId
      ).select("name email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Order user not found"
      });
    }

    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

    const invoiceSettings =
      await getInvoiceSettings();

    if (
      invoiceSettings.enabled === false
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice generation is disabled"
      });
    }

    // --------------------------------------------------
    // ORDER AMOUNT
    // --------------------------------------------------

    const originalCharge =
      Number(order.originalCharge) || 0;

    const discountAmount =
      Number(order.discountAmount) || 0;

    const charge =
      Number(order.charge) || 0;

    if (charge <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Order charge must be greater than 0"
      });
    }

    const subtotal =
      roundAmount(
        originalCharge > 0
          ? originalCharge
          : charge + discountAmount
      );

    const taxableAmount =
      roundAmount(charge);

    // --------------------------------------------------
    // GST
    // --------------------------------------------------

    const gstRate =
      Number(invoiceSettings.gstRate) || 0;

    const gst =
      calculateGST({
        taxableAmount,
        gstRate,
        sameState: true
      });

    // --------------------------------------------------
    // INVOICE NUMBER
    // --------------------------------------------------

    const invoiceNumber =
      await generateInvoiceNumber();

    // --------------------------------------------------
    // CREATE INVOICE
    // --------------------------------------------------

    let invoice;

    try {
      invoice =
        await Invoice.create({
          invoiceNumber,

          userId:
            order.userId,

          orderId:
            order._id,

          invoiceType:
            "order",

          customer: {
            name:
              user.name,

            email:
              user.email
          },

          seller: {
            businessName:
              invoiceSettings.businessName ||
              "",

            gstin:
              invoiceSettings.gstin ||
              "",

            address:
              invoiceSettings.address ||
              "",

            state:
              invoiceSettings.state ||
              "",

            stateCode:
              invoiceSettings.stateCode ||
              ""
          },

          items: [
            {
              orderId:
                order._id,

              description:
                `SMM Service Order ${order._id}`,

              quantity:
                Number(order.quantity) || 1,

              unitPrice:
                Number(order.quantity) > 0
                  ? roundAmount(
                      taxableAmount /
                      Number(order.quantity)
                    )
                  : taxableAmount,

              taxableAmount,

              gstRate:
                gst.gstRate,

              cgstRate:
                gst.cgstRate,

              sgstRate:
                gst.sgstRate,

              igstRate:
                gst.igstRate,

              cgstAmount:
                gst.cgstAmount,

              sgstAmount:
                gst.sgstAmount,

              igstAmount:
                gst.igstAmount,

              totalGstAmount:
                gst.totalGstAmount,

              totalAmount:
                gst.totalAmount
            }
          ],

          subtotal,

          totalDiscount:
            roundAmount(
              discountAmount
            ),

          taxableAmount,

          gstRate:
            gst.gstRate,

          cgstAmount:
            gst.cgstAmount,

          sgstAmount:
            gst.sgstAmount,

          igstAmount:
            gst.igstAmount,

          totalGstAmount:
            gst.totalGstAmount,

          totalAmount:
            gst.totalAmount,

          currency: "INR",

          status: "issued",

          issuedAt:
            new Date()
        });
    } catch (error) {
      // Duplicate invoice created concurrently.
      if (
        error &&
        error.code === 11000
      ) {
        const duplicateInvoice =
          await Invoice.findOne({
            orderId: order._id,
            invoiceType: "order"
          });

        if (duplicateInvoice) {
          return res.status(200).json({
            success: true,
            message:
              "Invoice already exists",
            invoice:
              duplicateInvoice
          });
        }
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message:
        "Order invoice created successfully",
      invoice
    });

  } catch (error) {
    return safeServerError(
      req,
      res,
      "CREATE ORDER INVOICE ERROR:",
      error
    );
  }
};

// ======================================================
// CREATE RECHARGE INVOICE
// ======================================================

const createRechargeInvoice = async (
  req,
  res
) => {
  try {
    const { paymentId } =
      req.body || {};

    // --------------------------------------------------
    // VALIDATE PAYMENT ID
    // --------------------------------------------------

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message:
          "paymentId is required"
      });
    }

    if (!isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID"
      });
    }

    // --------------------------------------------------
    // FIND PAYMENT
    // --------------------------------------------------

    const payment =
      await PaymentTransaction.findById(
        paymentId
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment transaction not found"
      });
    }

    // --------------------------------------------------
    // ONLY COMPLETED RECHARGES
    // --------------------------------------------------

    if (
      payment.transactionType !==
      "recharge"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only recharge transactions can have invoices"
      });
    }

    if (
      payment.status !==
      "completed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice can only be created for completed payments"
      });
    }

    // --------------------------------------------------
    // ACCESS CHECK
    // --------------------------------------------------

    const adminOrStaff =
      isAdminOrStaff(req);

    if (
      !adminOrStaff &&
      String(payment.userId) !==
        String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to create an invoice for this payment"
      });
    }

    // --------------------------------------------------
    // EXISTING INVOICE
    // --------------------------------------------------

    const existingInvoice =
      await Invoice.findOne({
        paymentTransactionId:
          payment._id,

        invoiceType:
          "recharge"
      });

    if (existingInvoice) {
      return res.status(200).json({
        success: true,
        message:
          "Invoice already exists",
        invoice:
          existingInvoice
      });
    }

    // --------------------------------------------------
    // USER
    // --------------------------------------------------

    const user =
      await User.findById(
        payment.userId
      ).select(
        "name email"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "Payment user not found"
      });
    }

    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

    const invoiceSettings =
      await getInvoiceSettings();

    if (
      invoiceSettings.enabled === false
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice generation is disabled"
      });
    }

    // --------------------------------------------------
    // AMOUNT
    // --------------------------------------------------

    const taxableAmount =
      roundAmount(
        Number(payment.amount) || 0
      );

    if (
      taxableAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than 0"
      });
    }

    // --------------------------------------------------
    // GST
    // --------------------------------------------------

    const gstRate =
      Number(
        invoiceSettings.gstRate
      ) || 0;

    const gst =
      calculateGST({
        taxableAmount,
        gstRate,
        sameState: true
      });

    // --------------------------------------------------
    // INVOICE NUMBER
    // --------------------------------------------------

    const invoiceNumber =
      await generateInvoiceNumber();

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    let invoice;

    try {
      invoice =
        await Invoice.create({
          invoiceNumber,

          userId:
            payment.userId,

          paymentTransactionId:
            payment._id,

          invoiceType:
            "recharge",

          customer: {
            name:
              user.name,

            email:
              user.email
          },

          seller: {
            businessName:
              invoiceSettings.businessName ||
              "",

            gstin:
              invoiceSettings.gstin ||
              "",

            address:
              invoiceSettings.address ||
              "",

            state:
              invoiceSettings.state ||
              "",

            stateCode:
              invoiceSettings.stateCode ||
              ""
          },

          items: [
            {
              paymentTransactionId:
                payment._id,

              description:
                `Wallet Recharge - ${
                  payment.paymentMethod
                }`,

              quantity:
                1,

              unitPrice:
                taxableAmount,

              taxableAmount,

              gstRate:
                gst.gstRate,

              cgstRate:
                gst.cgstRate,

              sgstRate:
                gst.sgstRate,

              igstRate:
                gst.igstRate,

              cgstAmount:
                gst.cgstAmount,

              sgstAmount:
                gst.sgstAmount,

              igstAmount:
                gst.igstAmount,

              totalGstAmount:
                gst.totalGstAmount,

              totalAmount:
                gst.totalAmount
            }
          ],

          subtotal:
            taxableAmount,

          totalDiscount:
            0,

          taxableAmount,

          gstRate:
            gst.gstRate,

          cgstAmount:
            gst.cgstAmount,

          sgstAmount:
            gst.sgstAmount,

          igstAmount:
            gst.igstAmount,

          totalGstAmount:
            gst.totalGstAmount,

          totalAmount:
            gst.totalAmount,

          currency:
            "INR",

          status:
            "issued",

          issuedAt:
            new Date()
        });
    } catch (error) {
      // Duplicate invoice created concurrently.
      if (
        error &&
        error.code === 11000
      ) {
        const duplicateInvoice =
          await Invoice.findOne({
            paymentTransactionId:
              payment._id,

            invoiceType:
              "recharge"
          });

        if (duplicateInvoice) {
          return res.status(200).json({
            success: true,
            message:
              "Invoice already exists",
            invoice:
              duplicateInvoice
          });
        }
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message:
        "Recharge invoice created successfully",
      invoice
    });

  } catch (error) {
    return safeServerError(
      req,
      res,
      "CREATE RECHARGE INVOICE ERROR:",
      error
    );
  }
};

// ======================================================
// GET INVOICE BY ID
// ======================================================

const getInvoiceById = async (
  req,
  res
) => {
  try {
    const { invoiceId } =
      req.params;

    if (!isValidObjectId(invoiceId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid invoice ID"
      });
    }

    const invoice =
      await Invoice.findById(
        invoiceId
      )
        .populate(
          "userId",
          "name email role"
        )
        .populate("orderId")
        .populate(
          "paymentTransactionId"
        );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message:
          "Invoice not found"
      });
    }

    const adminOrStaff =
      isAdminOrStaff(req);

    const invoiceUserId =
      invoice.userId?._id ||
      invoice.userId;

    if (
      !adminOrStaff &&
      String(invoiceUserId) !==
        String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to view this invoice"
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Invoice fetched successfully",
      invoice
    });

  } catch (error) {
    return safeServerError(
      req,
      res,
      "GET INVOICE ERROR:",
      error
    );
  }
};

// ======================================================
// GENERATE INVOICE PDF
// ======================================================

const generateInvoicePDF = async (
  req,
  res
) => {
  try {
    const { invoiceId } =
      req.params;

    // --------------------------------------------------
    // VALIDATE INVOICE ID
    // --------------------------------------------------

    if (!isValidObjectId(invoiceId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid invoice ID"
      });
    }

    // --------------------------------------------------
    // FIND INVOICE
    // --------------------------------------------------

    const invoice =
      await Invoice.findById(
        invoiceId
      )
        .populate(
          "userId",
          "name email role"
        )
        .populate("orderId")
        .populate(
          "paymentTransactionId"
        );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message:
          "Invoice not found"
      });
    }

    // --------------------------------------------------
    // ACCESS CHECK
    // --------------------------------------------------

    const adminOrStaff =
      isAdminOrStaff(req);

    const invoiceUserId =
      invoice.userId?._id ||
      invoice.userId;

    if (
      !adminOrStaff &&
      String(invoiceUserId) !==
        String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to generate this invoice"
      });
    }

    // --------------------------------------------------
    // PDF DIRECTORY
    // --------------------------------------------------

    const invoiceDirectory =
      path.join(
        __dirname,
        "../uploads/invoices"
      );

    if (
      !fs.existsSync(
        invoiceDirectory
      )
    ) {
      fs.mkdirSync(
        invoiceDirectory,
        {
          recursive: true
        }
      );
    }

    // --------------------------------------------------
    // SAFE FILE NAME
    // --------------------------------------------------

    const safeInvoiceNumber =
      sanitizeFileName(
        invoice.invoiceNumber
      );

    const fileName =
      `${safeInvoiceNumber}.pdf`;

    const filePath =
      path.join(
        invoiceDirectory,
        fileName
      );

    // --------------------------------------------------
    // CREATE PDF
    // --------------------------------------------------

    const doc =
      new PDFDocument({
        size: "A4",
        margin: 50
      });

    const writeStream =
      fs.createWriteStream(
        filePath
      );

    let responseSent =
      false;

    const sendPdfDatabaseError =
      async (error) => {
        console.error(
          "PDF DATABASE UPDATE ERROR:",
          error
        );

        if (
          !responseSent &&
          !res.headersSent
        ) {
          responseSent = true;

          return res.status(500).json({
            success: false,
            message:
              "PDF generated but database update failed",
            requestId:
              getRequestId(req)
          });
        }
      };

    const sendPdfWriteError =
      (error) => {
        console.error(
          "PDF WRITE ERROR:",
          error
        );

        if (
          !responseSent &&
          !res.headersSent
        ) {
          responseSent = true;

          return res.status(500).json({
            success: false,
            message:
              "Failed to generate invoice PDF",
            requestId:
              getRequestId(req)
          });
        }
      };

    doc.pipe(writeStream);

    const currency =
      invoice.currency || "INR";

    // --------------------------------------------------
    // HEADER
    // --------------------------------------------------

    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(
        "INVOICE",
        {
          align: "center"
        }
      );

    doc.moveDown();

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Invoice Number: ${invoice.invoiceNumber}`
      );

    doc.text(
      `Invoice Date: ${new Date(
        invoice.issuedAt
      ).toLocaleDateString(
        "en-IN"
      )}`
    );

    doc.text(
      `Status: ${invoice.status}`
    );

    doc.moveDown();

    // --------------------------------------------------
    // SELLER
    // --------------------------------------------------

    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Seller");

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        invoice.seller?.businessName ||
          "Gromage Infotech Pvt Ltd"
      );

    if (
      invoice.seller?.gstin
    ) {
      doc.text(
        `GSTIN: ${invoice.seller.gstin}`
      );
    }

    if (
      invoice.seller?.address
    ) {
      doc.text(
        `Address: ${invoice.seller.address}`
      );
    }

    if (
      invoice.seller?.state
    ) {
      doc.text(
        `State: ${invoice.seller.state}${
          invoice.seller.stateCode
            ? ` (${invoice.seller.stateCode})`
            : ""
        }`
      );
    }

    doc.moveDown();

    // --------------------------------------------------
    // CUSTOMER
    // --------------------------------------------------

    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Bill To");

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        invoice.customer?.name ||
          "Customer"
      );

    doc.text(
      invoice.customer?.email ||
        ""
    );

    doc.moveDown();

    // --------------------------------------------------
    // PLACE OF SUPPLY
    // --------------------------------------------------

    if (
      invoice.placeOfSupply?.state ||
      invoice.placeOfSupply?.stateCode
    ) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Place of Supply: ${
            invoice.placeOfSupply.state ||
            ""
          }${
            invoice.placeOfSupply.stateCode
              ? ` (${invoice.placeOfSupply.stateCode})`
              : ""
          }`
        );

      doc.moveDown();
    }

    // --------------------------------------------------
    // ITEMS
    // --------------------------------------------------

    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Items");

    doc.moveDown(0.5);

    let currentY =
      doc.y;

    doc
      .fontSize(9)
      .font("Helvetica-Bold");

    doc.text(
      "Description",
      50,
      currentY,
      {
        width: 230
      }
    );

    doc.text(
      "Qty",
      290,
      currentY
    );

    doc.text(
      "Unit Price",
      330,
      currentY
    );

    doc.text(
      "Taxable",
      420,
      currentY
    );

    doc.text(
      "Total",
      485,
      currentY
    );

    currentY += 18;

    doc
      .moveTo(
        50,
        currentY
      )
      .lineTo(
        545,
        currentY
      )
      .stroke();

    currentY += 10;

    // --------------------------------------------------
    // ITEM ROWS
    // --------------------------------------------------

    doc
      .font("Helvetica")
      .fontSize(9);

    for (
      const item of invoice.items || []
    ) {
      if (
        currentY > 700
      ) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(
        item.description || "-",
        50,
        currentY,
        {
          width: 230
        }
      );

      doc.text(
        String(
          item.quantity || 1
        ),
        290,
        currentY
      );

      doc.text(
        `${currency} ${Number(
          item.unitPrice || 0
        ).toFixed(2)}`,
        330,
        currentY
      );

      doc.text(
        `${currency} ${Number(
          item.taxableAmount || 0
        ).toFixed(2)}`,
        420,
        currentY
      );

      doc.text(
        `${currency} ${Number(
          item.totalAmount || 0
        ).toFixed(2)}`,
        485,
        currentY
      );

      currentY += 35;
    }

    // --------------------------------------------------
    // TOTALS
    // --------------------------------------------------

    currentY += 10;

    if (
      currentY > 680
    ) {
      doc.addPage();
      currentY = 60;
    }

    doc
      .moveTo(
        50,
        currentY
      )
      .lineTo(
        545,
        currentY
      )
      .stroke();

    currentY += 18;

    doc
      .font("Helvetica")
      .fontSize(10);

    doc.text(
      `Subtotal: ${currency} ${Number(
        invoice.subtotal || 0
      ).toFixed(2)}`,
      350,
      currentY
    );

    currentY += 18;

    doc.text(
      `Discount: ${currency} ${Number(
        invoice.totalDiscount || 0
      ).toFixed(2)}`,
      350,
      currentY
    );

    currentY += 18;

    doc.text(
      `Taxable Amount: ${currency} ${Number(
        invoice.taxableAmount || 0
      ).toFixed(2)}`,
      350,
      currentY
    );

    currentY += 18;

    if (
      Number(
        invoice.cgstAmount || 0
      ) > 0
    ) {
      doc.text(
        `CGST (${Number(
          invoice.gstRate || 0
        ) / 2}%): ${currency} ${Number(
          invoice.cgstAmount
        ).toFixed(2)}`,
        350,
        currentY
      );

      currentY += 18;
    }

    if (
      Number(
        invoice.sgstAmount || 0
      ) > 0
    ) {
      doc.text(
        `SGST (${Number(
          invoice.gstRate || 0
        ) / 2}%): ${currency} ${Number(
          invoice.sgstAmount
        ).toFixed(2)}`,
        350,
        currentY
      );

      currentY += 18;
    }

    if (
      Number(
        invoice.igstAmount || 0
      ) > 0
    ) {
      doc.text(
        `IGST (${Number(
          invoice.gstRate || 0
        )}%): ${currency} ${Number(
          invoice.igstAmount
        ).toFixed(2)}`,
        350,
        currentY
      );

      currentY += 18;
    }

    doc
      .font("Helvetica-Bold")
      .text(
        `Total GST: ${currency} ${Number(
          invoice.totalGstAmount || 0
        ).toFixed(2)}`,
        350,
        currentY
      );

    currentY += 24;

    doc
      .fontSize(13)
      .text(
        `TOTAL: ${currency} ${Number(
          invoice.totalAmount || 0
        ).toFixed(2)}`,
        350,
        currentY
      );

    // --------------------------------------------------
    // NOTES
    // --------------------------------------------------

    if (
      invoice.notes
    ) {
      currentY += 35;

      if (
        currentY > 700
      ) {
        doc.addPage();
        currentY = 60;
      }

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(
          "Notes",
          50,
          currentY
        );

      currentY += 15;

      doc
        .font("Helvetica")
        .text(
          invoice.notes,
          50,
          currentY,
          {
            width: 495
          }
        );
    }

    // --------------------------------------------------
    // FOOTER
    // --------------------------------------------------

    doc
      .fontSize(9)
      .font("Helvetica")
      .text(
        "Thank you for your business.",
        50,
        750,
        {
          align: "center",
          width: 495
        }
      );

    // --------------------------------------------------
    // PDF EVENTS
    // --------------------------------------------------

    writeStream.on(
      "error",
      sendPdfWriteError
    );

    writeStream.on(
      "finish",
      async () => {
        try {
          if (
            responseSent
          ) {
            return;
          }

          const pdfUrl =
            `/uploads/invoices/${fileName}`;

          invoice.pdfUrl =
            pdfUrl;

          invoice.pdfGenerated =
            true;

          invoice.pdfGeneratedAt =
            new Date();

          await invoice.save();

          if (
            !responseSent &&
            !res.headersSent
          ) {
            responseSent = true;

            return res.status(200).json({
              success: true,

              message:
                "Invoice PDF generated successfully",

              data: {
                invoiceId:
                  invoice._id,

                invoiceNumber:
                  invoice.invoiceNumber,

                pdfUrl,

                pdfGenerated:
                  invoice.pdfGenerated,

                pdfGeneratedAt:
                  invoice.pdfGeneratedAt
              }
            });
          }
        } catch (error) {
          return sendPdfDatabaseError(
            error
          );
        }
      }
    );

    // Finish PDF.
    doc.end();

  } catch (error) {
    return safeServerError(
      req,
      res,
      "GENERATE INVOICE PDF ERROR:",
      error
    );
  }
};

// ======================================================
// GET MY INVOICES
// ======================================================

const getMyInvoices = async (
  req,
  res
) => {
  try {
    const invoices =
      await Invoice.find({
        userId:
          req.user._id
      })
        .sort({
          createdAt: -1
        });

    return res.status(200).json({
      success: true,

      message:
        "Invoices fetched successfully",

      count:
        invoices.length,

      invoices
    });

  } catch (error) {
    return safeServerError(
      req,
      res,
      "GET MY INVOICES ERROR:",
      error
    );
  }
};

// ======================================================
// GET ALL INVOICES - ADMIN
// ======================================================

const getAllInvoices = async (
  req,
  res
) => {
  try {
    const page =
      Math.max(
        Number(req.query.page) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) || 20,
          1
        ),
        100
      );

    const skip =
      (page - 1) * limit;

    const filter = {};

    // --------------------------------------------------
    // VALIDATE INVOICE TYPE
    // --------------------------------------------------

    if (
      req.query.invoiceType
    ) {
      const allowedInvoiceTypes = [
        "order",
        "recharge"
      ];

      if (
        !allowedInvoiceTypes.includes(
          req.query.invoiceType
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid invoiceType"
        });
      }

      filter.invoiceType =
        req.query.invoiceType;
    }

    // --------------------------------------------------
    // VALIDATE STATUS
    // --------------------------------------------------

    if (
      req.query.status
    ) {
      const allowedStatuses = [
        "draft",
        "issued",
        "cancelled",
        "paid"
      ];

      if (
        !allowedStatuses.includes(
          req.query.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid invoice status"
        });
      }

      filter.status =
        req.query.status;
    }

    // --------------------------------------------------
    // FETCH
    // --------------------------------------------------

    const [
      invoices,
      total
    ] =
      await Promise.all([
        Invoice.find(filter)
          .populate(
            "userId",
            "name email role"
          )
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit),

        Invoice.countDocuments(
          filter
        )
      ]);

    return res.status(200).json({
      success: true,

      message:
        "Invoices fetched successfully",

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(
            total / limit
          )
      },

      invoices
    });

  } catch (error) {
    return safeServerError(
      req,
      res,
      "GET ALL INVOICES ERROR:",
      error
    );
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createOrderInvoice,
  createRechargeInvoice,
  getInvoiceById,
  generateInvoicePDF,
  getMyInvoices,
  getAllInvoices
};