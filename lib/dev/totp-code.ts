import "dotenv/config";
import { generate } from "otplib";

// Prints the current TOTP code for the demo admin, so you can sign in without an
// authenticator app during local testing. Run: `npm run totp`.
async function main() {
  const secret = process.env.ADMIN_TOTP_SECRET ?? "KS5DEMOADMINSEEDTOTPBASE32SECRET";
  const code = await generate({ secret });
  console.log(code);
}

void main();
