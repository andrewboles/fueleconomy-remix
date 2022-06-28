
import { getSession, commitSession } from "../../utils/session.server";
import { redirect } from "@remix-run/server-runtime";
export let loader = () => redirect("/");

export let action = async ({ request }) => {
  const session = await getSession();
  session.set("user", "dummylogin");
  return redirect('/', {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
};