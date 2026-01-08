import React from 'react';
import { addDays, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { Booking, TIME_SLOTS, MAX_CAPACITY } from '../types';

interface StatusCardProps {
  bookings: Booking[];
}

const StatusCard: React.FC<StatusCardProps> = ({ bookings }) => {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);

  const dayAfterTomorrowStr = format(dayAfterTomorrow, 'yyyy-MM-dd');
  const dayAfterTomorrowDisplay = format(dayAfterTomorrow, 'M.d EEEE', { locale: zhCN });
  const tomorrowDisplay = format(tomorrow, 'M.d EEEE', { locale: zhCN });

  // 1. Get all bookings for day after tomorrow
  const targetBookings = bookings.filter(b => b.date === dayAfterTomorrowStr);
  
  // 2. Count occupied people per slot
  const slotCounts = new Map<string, number>();
  TIME_SLOTS.forEach(t => slotCounts.set(t, 0));

  targetBookings.forEach(b => {
    // 每一行就是一个有效预约人数（无论队长还是组员）
    b.slot.split(',').forEach(s => {
      const slotName = s.trim();
      const current = slotCounts.get(slotName) || 0;
      slotCounts.set(slotName, current + 1);
    });
  });

  // 3. Determine status
  const fullyBookedSlots: string[] = [];
  const availableSlots: { name: string; remaining: number }[] = [];

  TIME_SLOTS.forEach(slot => {
    const count = slotCounts.get(slot) || 0;
    if (count >= MAX_CAPACITY) {
      fullyBookedSlots.push(slot);
    } else {
      availableSlots.push({ name: slot, remaining: MAX_CAPACITY - count });
    }
  });

  const isAllFull = availableSlots.length === 0;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-900 font-semibold text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          抢座监控
        </h2>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
          明天: {tomorrowDisplay}
        </span>
      </div>

      <div className={`rounded-xl p-4 flex items-start gap-3 transition-colors ${
        isAllFull 
          ? 'bg-green-50 border border-green-100 text-green-800' 
          : 'bg-amber-50 border border-amber-100 text-amber-900'
      }`}>
        <div className="mt-0.5">
          {isAllFull ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm sm:text-base">
              后天 ({dayAfterTomorrowDisplay})
            </h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isAllFull ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-900'}`}>
              {isAllFull ? '全满' : '可预约'}
            </span>
          </div>
          
          <div className="text-xs sm:text-sm mt-2 opacity-90">
            {isAllFull ? (
              <p>太棒了！所有时间段的座位都已约满。</p>
            ) : (
              <div>
                <p className="font-bold mb-1.5">剩余空位：</p>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map(item => (
                    <span key={item.name} className="inline-flex items-center gap-1 px-2 py-1 bg-white/60 border border-amber-200/60 rounded-md text-xs">
                      <span className="font-semibold">{item.name}</span>
                      <span className="bg-amber-500 text-white px-1 rounded-[3px] text-[10px] leading-tight h-3.5 flex items-center justify-center">
                        余{item.remaining}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusCard;