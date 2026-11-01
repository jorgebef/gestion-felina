import { X } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { parseKeywordList } from "@licita/domain/text";
import { cn } from "@/lib/utils";

/** Free-text tags: type and press Enter or comma. Pasting a list splits it. */
export function ChipInput({
  id,
  value,
  onChange,
  placeholder,
  tone = "default",
  max = 30,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: "default" | "negative";
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = parseKeywordList(raw).filter((k) => k.length >= 2 && k.length <= 80);
    if (!items.length) return;
    const lower = new Set(value.map((v) => v.toLowerCase()));
    onChange([...value, ...items.filter((k) => !lower.has(k.toLowerCase()))].slice(0, max));
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-input bg-card p-2 focus-within:ring-[3px] focus-within:ring-ring/30">
      {value.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((item) => (
            <li
              key={item}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm",
                tone === "negative"
                  ? "bg-negative-soft text-negative"
                  : "bg-brand-soft text-brand-strong",
              )}
            >
              {item}
              <button
                type="button"
                aria-label={`Quitar ${item}`}
                className="rounded opacity-70 hover:opacity-100"
                onClick={() => onChange(value.filter((v) => v !== item))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
        onChange={(e) => {
          const next = e.target.value;
          if (/[,;\n]/.test(next)) add(next);
          else setDraft(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
