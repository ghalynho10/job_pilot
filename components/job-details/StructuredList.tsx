import type { JSX } from "react";

type StructuredListProps = {
  label: string;
  items: string[];
};

export function StructuredList({ label, items }: StructuredListProps): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-base font-semibold text-text-primary">{label}</h3>
      <ul className="mt-2 list-disc space-y-2 ps-5 text-sm leading-6 text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
