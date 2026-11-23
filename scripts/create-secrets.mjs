import { createHash, randomBytes } from "node:crypto";

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  console.error("Bitte in einem interaktiven Terminal ausführen.");
  process.exit(1);
}
process.stdout.write("Neues Admin-Passwort (mindestens 20 Zeichen, Eingabe verborgen): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", chunk => {
  for (const character of chunk) {
    if (character === "\u0003") {
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      process.exit(1);
    }
    if (character === "\r" || character === "\n") {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (password.length < 20) {
        console.error("Bitte mindestens 20 Zeichen wählen und erneut ausführen.");
        process.exitCode = 1;
        return;
      }
      console.log(`ADMIN_PASSWORD_HASH=${createHash("sha256").update(password, "utf8").digest("hex")}`);
      console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
      password = "";
      return;
    }
    if (character === "\u007f" || character === "\b") password = password.slice(0, -1);
    else if (character >= " " && character !== "\u001b") password += character;
  }
});
