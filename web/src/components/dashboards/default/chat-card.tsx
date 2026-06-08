"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chatMessages as initial, chatContact, type ChatMessage } from "@/lib/data";

export function ChatCard() {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "me", content: text.trim() }]);
    setText("");
  }
  return (
    <Card className="flex flex-col">
      <CardHeader className="border-b">
        <CardTitle>New Message</CardTitle>
        <div className="flex flex-row items-center gap-3 pt-3">
          <Avatar className="size-9"><AvatarFallback>SD</AvatarFallback></Avatar>
          <div className="flex-1 text-sm">
            <p className="font-medium leading-none">{chatContact.name}</p>
            <p className="text-muted-foreground">{chatContact.email}</p>
          </div>
          <Button variant="outline" size="icon" className="size-8" aria-label="New message">
            <Plus className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[75%] rounded-lg px-3 py-2 text-sm",
              m.from === "me" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {m.content}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <form onSubmit={send} className="flex w-full items-center gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message..." />
          <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
