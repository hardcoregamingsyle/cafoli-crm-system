import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export function DateTimePicker({ date, setDate }: { date: Date | undefined; setDate: (date: Date | undefined) => void }) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date);

  React.useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  const handleSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const currentTime = selectedDate || new Date();
      newDate.setHours(currentTime.getHours());
      newDate.setMinutes(currentTime.getMinutes());
    }
    setSelectedDate(newDate);
    setDate(newDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    if (!selectedDate) {
        // If no date selected, default to today
        const now = new Date();
        const [hours, minutes] = time.split(":").map(Number);
        now.setHours(hours);
        now.setMinutes(minutes);
        setSelectedDate(now);
        setDate(now);
        return;
    }
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setSelectedDate(newDate);
    setDate(newDate);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP p") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
        <div className="p-3 border-t border-border">
          <input
            type="time"
            className="w-full p-2 border rounded-md bg-background text-foreground"
            value={selectedDate ? format(selectedDate, "HH:mm") : ""}
            onChange={handleTimeChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
