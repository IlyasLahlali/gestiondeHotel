const registerReturn = new URLSearchParams(window.location.search).get("return");
const loginAfterRegister = registerReturn
  ? `login.html?return=${encodeURIComponent(registerReturn)}`
  : "login.html";

bindRegisterForm({
  formId: "registerForm",
  endpoint: "/auth/client/register",
  messageId: "message",
  redirectUrl: loginAfterRegister,
  passwordFieldId: "password"
});
