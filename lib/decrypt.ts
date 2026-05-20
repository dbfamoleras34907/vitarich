import CryptoJS from "crypto-js";

const SECRET = process.env.NEXT_PUBLIC_APPROVAL_SECRET!;

export function decryptValue(value: string) {
  // console.log({ value, SECRET })
  const bytes = CryptoJS.AES.decrypt(value, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
