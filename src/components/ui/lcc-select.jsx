"use client";

import * as React from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

export default function LccSelect({
  value,
  onValueChange,
  placeholder = "Select",
  items = [],
  className = "",
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        className={`flex h-11 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-left text-sm text-white outline-none transition hover:bg-white/[0.06] focus:ring-2 focus:ring-white/10 ${className}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-white/70" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          className="z-[99999] max-h-80 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1322] shadow-[0_24px_60px_rgba(0,0,0,.65)]"
        >
          <Select.Viewport className="p-2">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="relative flex cursor-pointer select-none items-center rounded-xl py-2.5 pl-9 pr-3 text-sm text-white/90 outline-none transition hover:bg-white/10 data-[highlighted]:bg-white/10"
              >
                <span className="absolute left-3 inline-flex w-4 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check className="h-4 w-4 text-white" />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}