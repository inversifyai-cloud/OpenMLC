"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onFiles?: (files: FileList) => void;
};

export function useDragDrop({ onFiles }: Props = {}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    function onEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes("Files")) return;
      counter.current++;
      setIsDraggingOver(true);
      e.preventDefault();
    }

    function onLeave() {
      counter.current = Math.max(0, counter.current - 1);
      if (counter.current === 0) setIsDraggingOver(false);
    }

    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function onDrop(e: DragEvent) {
      e.preventDefault();
      counter.current = 0;
      setIsDraggingOver(false);
      if (e.dataTransfer?.files && onFiles) {
        onFiles(e.dataTransfer.files);
      }
    }

    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [onFiles]);

  return { isDraggingOver };
}
