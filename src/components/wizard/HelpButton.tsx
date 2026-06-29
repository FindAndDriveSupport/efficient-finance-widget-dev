import { HelpCircle, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const terms = [
  { term: "Soft credit check", def: "A preliminary look at your credit profile that does NOT affect your credit score. Used to estimate your eligibility." },
  { term: "Affordability check", def: "An assessment of your income vs. expenses to determine how much you can responsibly afford to repay each month." },
  { term: "Net income", def: "Your take-home pay after tax, UIF and other deductions." },
  { term: "Gross income", def: "Your total income before any deductions or taxes." },
  { term: "Pre-qualification", def: "An early indication of finance eligibility, before a full application is submitted to a financial institution." },
];

export function HelpButton() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="Help"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[90vh] flex-col rounded-t-3xl p-0"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SheetHeader className="sticky top-0 z-10 flex-row items-center justify-between space-y-0 border-b border-border bg-background px-5 py-4">
          <SheetTitle className="text-left">Need a hand?</SheetTitle>
          <SheetClose
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {terms.map((t) => (
            <div key={t.term} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{t.term}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.def}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
