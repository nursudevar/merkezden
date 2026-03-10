"use client";

import React, { useRef, useState } from "react";
import { X, MessageCircle } from "lucide-react";
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
}) => (
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
);

ExpandableChatToggle.displayName = "ExpandableChatToggle";

export {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
};
