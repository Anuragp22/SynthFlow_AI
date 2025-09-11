"use client";

import { authClient } from "~/lib/auth-client";
import { Button } from "../ui/button";

export default function Upgrade() {
  const upgrade = async () => {
    await authClient.checkout({
      products: [
        "e5e4606c-6064-48c4-9464-6838b250a248", 
        "74c7860d-6374-4544-8fa7-dd7bf6a1b2cb",
        "c7e3bd0b-fe56-42c6-ab85-1c56a210ce8c",
      ],
    });
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-2 cursor-pointer text-orange-400"
      onClick={upgrade}
    >
      Upgrade
    </Button>
  );
}