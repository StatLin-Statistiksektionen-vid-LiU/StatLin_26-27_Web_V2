"use client";

import { useEffect } from "react";
import { markWishesSeen } from "@/app/admin/_actions/onskelada";

/** Nollställer siffran för nya önskemål i sidomenyn när utskottet har öppnat sin sida. */
export function MarkWishesSeen({ committeeId }: { committeeId: number }) {
  useEffect(() => {
    void markWishesSeen(committeeId);
  }, [committeeId]);
  return null;
}
