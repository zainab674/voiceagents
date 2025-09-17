import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string;
}

interface ConversationAgentFilterProps {
  agents: Agent[];
  selectedAgentId: string;
  onAgentChange: (agentId: string) => void;
  isLoading?: boolean;
}

export function ConversationAgentFilter({ 
  agents, 
  selectedAgentId, 
  onAgentChange, 
  isLoading = false 
}: ConversationAgentFilterProps) {
  return (
    <div className="flex items-center space-x-2">
      <Filter className="w-3 h-3 text-gray-500 dark:text-gray-400" />
      <Select
        value={selectedAgentId}
        onValueChange={onAgentChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-32 h-6 text-xs">
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Agents</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
