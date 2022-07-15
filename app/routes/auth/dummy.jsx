
import { getSession, commitSession } from "../../utils/session.server";
import { redirect } from "@remix-run/server-runtime";
export let loader = () => redirect("/");

//this allows users the ability to login via a dummy account
export let action = async ({ request }) => {
  const session = await getSession();
  session.set("user", "dummylogin");
  return redirect('/', {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
};