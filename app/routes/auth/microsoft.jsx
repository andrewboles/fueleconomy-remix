
import { authenticator } from "../../utils/auth.server";

export let loader = () => redirect("/");

export let action = ({ request }) => {
  return authenticator.authenticate("microsoft", request);
};