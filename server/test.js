const dns = require("dns");

dns.resolveSrv(
  "_mongodb._tcp.gromage-cluster.mfp3bmg.mongodb.net",
  (err, records) => {
    console.log("Error:", err);
    console.log("Records:", records);
  }
);