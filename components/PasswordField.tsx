"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
}

export function PasswordField({ value, onValueChange, ...rest }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <input
        {...rest}
        type={shown ? "text" : "password"}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onValueChange(e.target.value)}
      />
      <button
        type="button"
        className="eye"
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
