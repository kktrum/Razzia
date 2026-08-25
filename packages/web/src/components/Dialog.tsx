import * as RadixDialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import type { ComponentProps } from "react"
import { twMerge } from "tailwind-merge"

export const Dialog = RadixDialog.Root

export const DialogTrigger = RadixDialog.Trigger

export const DialogClose = RadixDialog.Close

export const DialogTitle = RadixDialog.Title

type DialogContentProps = ComponentProps<typeof RadixDialog.Content>

export const DialogContent = ({
  className,
  children,
  ...props
}: DialogContentProps) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="data-[state=open]:animate-fade-in z-overlay fixed inset-0 bg-black/50" />

    {/*
      This wrapper (rather than positioning RadixDialog.Content itself with
      `fixed inset-0 ... p-4`) is what guarantees the viewport gutter and
      max-height clamp below can never be overridden by a caller's
      `className` on DialogContent: twMerge only rewrites classes on
      RadixDialog.Content, so a consumer like ResultModal that swaps in its
      own `max-w-2xl`/`max-h-[92vh]` can never touch this element's
      `p-4`/centering, which is what actually keeps the panel off the screen
      edges on narrow viewports.
    */}
    <div className="z-modal fixed inset-0 flex items-center justify-center p-4">
      <RadixDialog.Content
        aria-describedby={undefined}
        className={twMerge(
          clsx(
            "bg-card max-h-full w-full max-w-md overflow-y-auto rounded-2xl shadow-xl",
            className,
          ),
        )}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </div>
  </RadixDialog.Portal>
)
