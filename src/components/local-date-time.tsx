"use client";

import { useSyncExternalStore } from "react";

type LocalDateTimeProps = {
  value: string;
  dateStyle?: "short" | "medium" | "long" | "full";
  timeStyle?: "short" | "medium" | "long" | "full";
  className?: string;
};

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LocalDateTime({
  value,
  dateStyle,
  timeStyle,
  className,
}: LocalDateTimeProps) {
  const isClient = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const date = new Date(value);
  const formattedDate = isClient && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle, timeStyle }).format(date)
    : "\u00a0";

  return (
    <time dateTime={value} className={className}>
      {formattedDate}
    </time>
  );
}
