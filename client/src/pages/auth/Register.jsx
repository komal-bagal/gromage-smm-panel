import { useState } from "react";
import "./Register.css";

function Register() {

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    whatsapp: "",
    password: "",
    confirmPassword: ""
  });


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };


  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    console.log(formData);
  };


  return (
    <div className="register-container">
      <div className="register-box">


        <button className="google-btn">
          🌈 Sign up with Google
        </button>


        <form onSubmit={handleSubmit}>

          <label>Username</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
          />


          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />


          <label>WhatsApp</label>
          <input
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
          />


          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />


          <label>Confirm password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
          />


          <button type="submit">
            Sign up
          </button>

        </form>


        <p>
          Already have an account? <a href="/login">Sign In</a>
        </p>

      </div>
    </div>
  );
}

export default Register;