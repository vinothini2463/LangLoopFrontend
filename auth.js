
const API_BASE = "https://fullstackbackend-88h0.onrender.com";

/* ===========================
   REGISTER
=========================== */

const registerForm = document.getElementById("register-form");

if(registerForm){

registerForm.addEventListener("submit", async function(e){

e.preventDefault();

const username = document.getElementById("username").value.trim();
const password = document.getElementById("password").value;
const role = document.getElementById("role").value;

const error = document.getElementById("error");
const btn = document.getElementById("registerBtn");

error.innerHTML = "";

if(username==="" || password===""){

error.innerHTML="Please fill all fields.";
return;

}

btn.innerHTML="Registering...";
btn.disabled=true;

try{

const response = await fetch(API_BASE + "/auth/register",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

username:username,
password:password,
role:role

})

});

if(response.ok){

alert("Registration Successful");

window.location.href="login.html";

}
else{

const data=await response.json();

error.innerHTML=data.message || "Registration Failed";

}

}
catch(err){

error.innerHTML="Cannot connect to backend.";

}

btn.innerHTML="Register";
btn.disabled=false;

});

}


/* ===========================
      LOGIN
=========================== */

const loginForm = document.getElementById("login-form");

if(loginForm){

loginForm.addEventListener("submit",async function(e){

e.preventDefault();

const username=document.getElementById("username").value.trim();
const password=document.getElementById("password").value;

const error=document.getElementById("error");
const btn=document.getElementById("loginBtn");

error.innerHTML="";

if(username==="" || password===""){

error.innerHTML="Please enter Username and Password.";
return;

}

btn.innerHTML="Logging in...";
btn.disabled=true;

try{

const response=await fetch(API_BASE+"/auth/login",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

username:username,
password:password

})

});

const data=await response.json();

if(response.ok){

localStorage.setItem("token",data.token);

alert("Login Successful");

window.location.href="dashboard.html";

}
else{

error.innerHTML=data.message;

}

}
catch(err){

error.innerHTML="Backend Server Not Running.";

}

btn.innerHTML="Login";
btn.disabled=false;

});

}

//
