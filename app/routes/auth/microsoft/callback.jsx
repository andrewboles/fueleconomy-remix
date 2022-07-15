// app/routes/auth/microsoft/callback.tsx
import { authenticator } from "../../../utils/auth.server";

//this is a necessary redirect page for OAuth2
export let loader = ({ request }) => {
  console.log(request)
  return authenticator.authenticate("microsoft", request, {
    successRedirect: "/",
    failureRedirect: "/",
  });
};