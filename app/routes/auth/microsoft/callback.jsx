// app/routes/auth/microsoft/callback.tsx
import { authenticator } from "../../../utils/auth.server";

export let loader = ({ request }) => {
  console.log(request)
  return authenticator.authenticate("microsoft", request, {
    successRedirect: "/",
    failureRedirect: "/",
  });
};