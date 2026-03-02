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
}

export function UserProfileCard({ email, description }: UserProfileCardProps) {

  return (
    <div className="group flex items-center gap-3 p-2 rounded-lg transition-colors bg-background w-full border border-transparent hover:border-border cursor-pointer">

      <Avatar className="h-9 w-9 shrink-0 transition-transform active:scale-95">
        <AvatarImage
          src={`https://github.com/identicons/${email.charAt(3)}.png`}
          alt="Profile"
        />
        <AvatarFallback className="bg-orange-600 text-white font-semibold uppercase">
          {email.charAt(0)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col text-left min-w-0">
        <span
          title={email}
          className="text-sm font-medium leading-none text-foreground"
        >
          {shortenText(email, 18)}
        </span>
        <span
          title={description}
          className="text-xs mt-1.5 leading-none text-muted-foreground"
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