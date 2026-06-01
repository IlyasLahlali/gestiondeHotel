bindLoginForm({
  formId: "loginForm",
  endpoint: "/auth/client/login",
  messageId: "loginMessage",
  redirectUrl: () => resolveAuthReturnUrl("Dashboard.html")
});
