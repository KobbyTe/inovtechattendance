import { useMemo } from "react";
import { motion } from "framer-motion";

const PALETTE = ["#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#F59E0B", "#FBBF24"];

export function ReviewWordCloud({ words }: { words: string[] }) {
  const items = useMemo(() => {
    const counts = new Map<string, number>();
    words.forEach((w) => {
      const k = w.trim().toLowerCase();
      if (!k) return;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const arr = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
    const max = arr[0]?.[1] ?? 1;
    const min = arr[arr.length - 1]?.[1] ?? 1;
    return arr.map(([word, count], i) => {
      const t = max === min ? 1 : (count - min) / (max - min);
      const size = 12 + t * 30; // px
      return {
        word,
        count,
        size,
        color: PALETTE[i % PALETTE.length],
        weight: 400 + Math.round(t * 500),
      };
    });
  }, [words]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        AI is still analyzing feedback — themes will appear here as reviews come in.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 items-baseline justify-center py-4">
      {items.map((it, i) => (
        <motion.span
          key={it.word}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.02, type: "spring", stiffness: 260, damping: 22 }}
          whileHover={{ scale: 1.12 }}
          title={`${it.word} · ${it.count}`}
          style={{
            fontSize: `${it.size}px`,
            color: it.color,
            fontWeight: it.weight,
            lineHeight: 1,
          }}
          className="cursor-default select-none tracking-tight"
        >
          {it.word}
        </motion.span>
      ))}
    </div>
  );
}