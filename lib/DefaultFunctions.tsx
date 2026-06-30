import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "./Supabase/supabaseClient";
import { Button } from "@/components/ui/button";


export function shortenText(text: string, maxLength: number = 20): string {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}


interface UserProfileCardProps {
  email: string;
  description: string;
  collapsed?: boolean;
}

export function UserProfileCard({ email, description, collapsed = false }: UserProfileCardProps) {

  return (
    <div className={`group flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 transition-colors hover:bg-secondary ${collapsed ? "justify-center px-0" : ""}`}>

      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage
          src={`https://github.com/identicons/${email.charAt(3)}.png`}
          alt="Profile"
        />
        <AvatarFallback className="bg-orange-600 text-white font-semibold uppercase">
          {email.charAt(0)}
        </AvatarFallback>
      </Avatar>

      <div className={`min-w-0 flex-1 flex-col text-left ${collapsed ? "hidden" : "flex"}`}>
        <span
          title={email}
          className="text-sm font-medium leading-none text-foreground"
        >
          {shortenText(email, 18)}
        </span>
        <span
          title={description}
          className="mt-1 hidden text-xs leading-none text-muted-foreground"
        >
          {shortenText(description, 24)}
        </span>
      </div>
    </div>
  );
}


export const extractNumbersArray = (str: string): number[] => {
  const matches = str.match(/\d+/g);
  return matches ? matches.map(Number) : [];
};




export function getDateOnly(input?: Date | string | number): string {
  const d = input ? new Date(input) : new Date();

  if (isNaN(d.getTime())) return '';

  return d.toISOString().split('T')[0];
}
