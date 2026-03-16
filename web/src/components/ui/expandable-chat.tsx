"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { X, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ChatPosition = "bottom-right" | "bottom-left";
export type ChatSize = "sm" | "md" | "lg" | "xl" | "full";

const positionClasses: Record<ChatPosition, string> = {
  "bottom-right": "expandable-chat--bottom-right",
  "bottom-left": "expandable-chat--bottom-left",
};

const sizeClasses: Record<ChatSize, string> = {
  sm: "expandable-chat-panel--sm",
  md: "expandable-chat-panel--md",
  lg: "expandable-chat-panel--lg",
  xl: "expandable-chat-panel--xl",
  full: "expandable-chat-panel--full",
};

const panelPositionClasses: Record<ChatPosition, string> = {
  "bottom-right": "expandable-chat-panel--pos-bottom-right",
  "bottom-left": "expandable-chat-panel--pos-bottom-left",
};

interface ExpandableChatProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: ChatPosition;
  size?: ChatSize;
  icon?: React.ReactNode;
}

const ExpandableChat: React.FC<ExpandableChatProps> = ({
  className,
  position = "bottom-right",
  size = "md",
  icon,
  children,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const toggleChat = () => setIsOpen(!isOpen);

  return (
    <div
      className={cn("expandable-chat", positionClasses[position], className)}
      {...props}
    >
      <div
        ref={chatRef}
        className={cn(
          "expandable-chat-panel",
          panelPositionClasses[position],
          sizeClasses[size],
          isOpen ? "expandable-chat-panel--open" : "expandable-chat-panel--closed"
        )}
      >
        {children}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="expandable-chat-close-btn"
          onClick={toggleChat}
          aria-label="Sohbeti kapat"
        >
          <X className="expandable-chat-close-icon" aria-hidden />
        </Button>
      </div>

      <ExpandableChatToggle
        icon={icon}
        isOpen={isOpen}
        toggleChat={toggleChat}
      />
    </div>
  );
};

ExpandableChat.displayName = "ExpandableChat";

const ExpandableChatHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn("expandable-chat-header", className)}
    {...props}
  />
);

ExpandableChatHeader.displayName = "ExpandableChatHeader";

const ExpandableChatBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div className={cn("expandable-chat-body", className)} {...props} />
);

ExpandableChatBody.displayName = "ExpandableChatBody";

const ExpandableChatFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("expandable-chat-footer", className)} {...props} />;

ExpandableChatFooter.displayName = "ExpandableChatFooter";

interface ExpandableChatToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  isOpen: boolean;
  toggleChat: () => void;
}

const ExpandableChatToggle: React.FC<ExpandableChatToggleProps> = ({
  className,
  icon,
  isOpen,
  toggleChat,
  ...props
}) => {
  const [burstId, setBurstId] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBurstId((id) => id + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const particles = useMemo(() => {
    const count = 8;
    const radius = 50;
    return Array.from({ length: count }).map((_, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return {
        id: `${burstId}-${index}`,
        x,
        y,
        delay: index * 0.04,
      };
    });
  }, [burstId]);

  return (
    <div className="expandable-chat-toggle-wrapper">
      <div className="expandable-chat-particles" aria-hidden>
        {particles.map((particle) => (
          <motion.span
            key={particle.id}
            className="expandable-chat-particle"
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: particle.x,
              y: particle.y,
            }}
            transition={{
              duration: 1.4,
              ease: "easeOut",
              delay: particle.delay,
            }}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="default"
        onClick={toggleChat}
        className={cn("expandable-chat-toggle", className)}
        aria-label={isOpen ? "Sohbeti kapat" : "Sohbeti aç"}
        aria-expanded={isOpen}
        {...props}
      >
        {isOpen ? (
          <X className="expandable-chat-toggle-icon" aria-hidden />
        ) : (
          icon || <MessageCircle className="expandable-chat-toggle-icon" aria-hidden />
        )}
      </Button>
    </div>
  );
};

ExpandableChatToggle.displayName = "ExpandableChatToggle";

export {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
};
