"use client";

import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, CaretRight, Circle } from "@phosphor-icons/react";
import * as React from "react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-none px-2.5 py-1.5 text-sm text-[color:var(--framer-fresco-menuText-color)] outline-none focus:bg-[var(--framer-fresco-menuBackgroundActive-color)] focus:text-[color:var(--framer-fresco-menuTextActive-color)] data-[state=open]:bg-[var(--framer-fresco-menuBackgroundActive-color)] data-[state=open]:text-[color:var(--framer-fresco-menuTextActive-color)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <CaretRight className="ml-auto size-4" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-menuBackground-color)] p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-none border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-menuBackground-color)] p-1 text-[color:var(--framer-fresco-menuText-color)] shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex min-h-8 cursor-default select-none items-center gap-2.5 rounded-none px-2 py-1.5 text-sm outline-none transition-colors focus:bg-[var(--framer-fresco-menuBackgroundActive-color)] focus:text-[color:var(--framer-fresco-menuTextActive-color)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "default" &&
          "text-[color:var(--framer-fresco-menuText-color)]",
        variant === "destructive" && "text-[color:var(--framer-fresco-errorTint-color)] focus:bg-[var(--framer-app-danger-callout-background-color)] focus:text-[color:var(--framer-app-danger-callout-text-color)]",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.CheckboxItem
>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex min-h-8 cursor-default select-none items-center gap-2.5 rounded-none py-1.5 pl-8 pr-2.5 text-sm text-[color:var(--framer-fresco-menuText-color)] outline-none transition-colors focus:bg-[var(--framer-fresco-menuBackgroundActive-color)] focus:text-[color:var(--framer-fresco-menuTextActive-color)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Check className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "relative flex min-h-8 cursor-default select-none items-center gap-2.5 rounded-none py-1.5 pl-8 pr-2.5 text-sm text-[color:var(--framer-fresco-menuText-color)] outline-none transition-colors focus:bg-[var(--framer-fresco-menuBackgroundActive-color)] focus:text-[color:var(--framer-fresco-menuTextActive-color)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        "px-2.5 py-1.5 text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)]",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn(
        "-mx-2 my-1 h-px bg-[var(--framer-fresco-panelDivider-color)]",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-[color:var(--framer-fresco-panelDescription-color)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
