import React, { useState } from 'react';
import { format, isToday, isTomorrow, isSameDay, addDays } from 'date-fns';
import {zhCN} from 'date-fns/locale/zh-CN';
import { History, Users, Clock, CalendarDays, Sparkles, X, Quote } from 'lucide-react';
import { Booking } from '../types';

interface HistoryListProps {
  bookings: Booking[];
  loading: boolean;
}

interface HitokotoData {
  hitokoto: string;
  from: string;
  from_who: string | null;
}

// 聚合后的数据结构 (用于前端展示)
interface AggregatedSlot {
  id: string; // 唯一Key
  dateStr: string;
  dateObj: Date;
  slotTime: string; // "9:00-13:00"
  leader: string | null; // 队长名字 (可能为空)
  members: string[]; // 组员名字列表
}

const HistoryList: React.FC<HistoryListProps> = ({ bookings, loading }) => {
  // 彩蛋状态
  const [showEgg, setShowEgg] = useState(false);
  const [eggData, setEggData] = useState<HitokotoData | null>(null);
  const [eggLoading, setEggLoading] = useState(false);

  // 触发彩蛋
  const triggerEasterEgg = async () => {
    setEggLoading(true);
    setShowEgg(true); // 先打开弹窗显示加载中
    
    // 增加类别：d=文学, i=诗词, k=哲学 (增加出现作者的概率)
    // 增加时间戳防止缓存
    const fetchUrl = `https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json`;

    try {
      // ⚡️ 策略：并发请求两次
      // 目的1：防止缓存重复
      // 目的2：优先展示有“作者”的数据，减少“佚名”出现的概率
      const req1 = fetch(`${fetchUrl}&t=${Date.now()}_1`).then(r => r.json());
      const req2 = fetch(`${fetchUrl}&t=${Date.now()}_2`).then(r => r.json());

      const [data1, data2] = await Promise.all([req1, req2]);

      let selectedData = data2; // 默认取第二个

      // 🧠 智能筛选逻辑：
      // 如果 data1 有作者而 data2 没有，优先选 data1
      if (data1.from_who && !data2.from_who) {
        selectedData = data1;
      } 
      // 如果 data2 没有作者且内容过短，尝试选 data1
      else if (!data2.from_who && data2.hitokoto.length < 5 && data1.hitokoto.length > 5) {
        selectedData = data1;
      }
      
      setEggData(selectedData);

    } catch (e) {
      console.error("彩蛋碎了...", e);
      setEggData({
        hitokoto: "生活原本沉闷，但跑起来就有风。",
        from: "网络",
        from_who: "佚名"
      });
    } finally {
      setEggLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 min-h-[200px] flex flex-col items-center justify-center text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-indigo-600 mb-3"></div>
        <p className="text-gray-400 text-sm">加载记录中...</p>
      </div>
    );
  }

  // Helper: Get numeric start hour for sorting (9, 14, 19)
  const getSlotStartHour = (slotStr: string) => {
    const match = slotStr.match(/^(\d+):/);
    return match ? parseInt(match[1], 10) : 99;
  };

  // 1. Define range: Today, Tomorrow, Day After
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const validDates = [today, tomorrow, dayAfterTomorrow];

  // 2. 核心聚合逻辑：将独立的Booking行合并为 AggregatedSlot
  const aggregatedSlots: AggregatedSlot[] = [];

  // Key: "YYYY-MM-DD|9:00-13:00"
  // Value: { dateObj, leader: string | null, members: string[] }
  const groupingMap = new Map<string, { dateObj: Date, leader: string | null, members: string[] }>();

  bookings.forEach(booking => {
     // 检查日期范围
     const bookingDateObj = new Date(booking.date);
     const isInRange = validDates.some(d => format(d, 'yyyy-MM-dd') === booking.date);
     
     if (isInRange) {
        // 处理多个时间段的情况
        const slots = booking.slot.split(',').map(s => s.trim());
        
        slots.forEach(slotTime => {
           const key = `${booking.date}|${slotTime}`;
           const current = groupingMap.get(key) || { dateObj: bookingDateObj, leader: null, members: [] };
           
           // 根据 Booking 的 members 字段（存的是身份）来判断
           if (booking.members === 'leader') {
               current.leader = booking.leader; // 如果身份是队长，名字记入leader
           } else {
               current.members.push(booking.leader); // 否则名字记入members
           }
           
           groupingMap.set(key, current);
        });
     }
  });

  // Map 转 Array
  groupingMap.forEach((val, key) => {
     const [dateStr, slotTime] = key.split('|');
     
     // 只要有人（无论队长还是组员）都显示该条目
     if (val.leader || val.members.length > 0) {
        aggregatedSlots.push({
           id: key,
           dateStr,
           dateObj: val.dateObj,
           slotTime,
           leader: val.leader, // 可能为 null，如果不为空则是队长名
           members: val.members
        });
     }
  });

  // 3. Sort Aggregated Slots
  aggregatedSlots.sort((a, b) => {
     // Sort by Date
     if (a.dateStr !== b.dateStr) return a.dateStr > b.dateStr ? 1 : -1;
     // Sort by Time
     return getSlotStartHour(a.slotTime) - getSlotStartHour(b.slotTime);
  });

  // 4. Group by Date for display
  const displayGroups: { dateStr: string; dateObj: Date; slots: AggregatedSlot[] }[] = [];
  
  validDates.forEach(d => {
     const dStr = format(d, 'yyyy-MM-dd');
     const slotsForDay = aggregatedSlots.filter(s => s.dateStr === dStr);
     if (slotsForDay.length > 0) {
        displayGroups.push({ dateStr: dStr, dateObj: d, slots: slotsForDay });
     }
  });


  return (
    <>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 h-full">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-50">
          <History className="w-5 h-5 text-indigo-600" />
          <h2 className="text-gray-900 font-semibold text-lg">近期预约列表</h2>
        </div>

        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">暂无有效预约</p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayGroups.map((group) => {
              let badgeText = format(group.dateObj, 'EEEE', { locale: zhCN });
              let dateLabel = format(group.dateObj, 'M月d日', { locale: zhCN });
              let headerClass = "text-gray-500 bg-gray-50";

              if (isToday(group.dateObj)) {
                badgeText = "今天";
                headerClass = "text-blue-600 bg-blue-50";
              } else if (isTomorrow(group.dateObj)) {
                badgeText = "明天";
                headerClass = "text-indigo-600 bg-indigo-50";
              } else if (isSameDay(group.dateObj, dayAfterTomorrow)) {
                badgeText = "后天";
                headerClass = "text-purple-600 bg-purple-50";
              }

              return (
                <div key={group.dateStr} className="relative">
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white z-10 py-1">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${headerClass}`}>
                      {badgeText}
                    </div>
                    <span className="text-sm font-semibold text-gray-400">{dateLabel}</span>
                    <div className="h-px bg-gray-100 flex-1"></div>
                  </div>

                  {/* Booking Items (Aggregated by Slot) */}
                  <div className="grid gap-3">
                    {group.slots.map((slotItem) => (
                      <div 
                        key={slotItem.id} 
                        onClick={triggerEasterEgg}
                        className="group p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50 hover:bg-white cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white relative overflow-hidden"
                      >
                        {/* Interactive Hint */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        </div>

                        {/* Slots Header in Card */}
                        <div className="flex flex-wrap gap-2 mb-2.5">
                            <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                              <Clock className="w-3 h-3" />
                              {slotItem.slotTime}
                            </div>
                        </div>

                        {/* Info Row */}
                        <div className="flex items-start justify-between gap-4">
                          {/* Leader Section */}
                          <div className="flex items-center gap-2">
                            {slotItem.leader ? (
                                // 有队长的情况
                                <>
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                      {slotItem.leader[0]}
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-gray-800 leading-tight">
                                        {slotItem.leader}
                                        <span className="ml-1.5 text-[10px] font-normal text-gray-400 border border-gray-100 px-1 rounded-md">队长</span>
                                      </div>
                                    </div>
                                </>
                            ) : (
                                // 缺队长的情况
                                <>
                                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">
                                      缺
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-gray-400 leading-tight">
                                        缺队长
                                      </div>
                                    </div>
                                </>
                            )}
                          </div>
                          
                          {/* Members (Other Bookers) */}
                          <div className="text-right flex-1">
                             <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-end gap-1">
                               <Users className="w-3 h-3" />
                               {slotItem.members.length > 0 ? '随行/组员' : '等待组员'}
                             </div>
                             <div className="text-sm text-gray-600 font-medium truncate max-w-[120px] ml-auto">
                               {slotItem.members.length > 0 ? slotItem.members.join(', ') : '-'}
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 彩蛋 Modal */}
      {showEgg && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowEgg(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 text-indigo-600">
                <Sparkles className="w-6 h-6 animate-pulse" />
                <h3 className="text-lg font-bold">恭喜发现彩蛋！</h3>
              </div>
              <button 
                onClick={() => setShowEgg(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="min-h-[120px] flex flex-col justify-center">
              {eggLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 text-gray-400 py-4">
                  <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
                  <span className="text-xs">正在翻阅书海...</span>
                </div>
              ) : (
                <div className="text-center relative z-10">
                  <Quote className="w-8 h-8 text-indigo-100 mx-auto mb-2 transform rotate-180" />
                  <p className="text-lg text-gray-800 font-medium leading-relaxed mb-4 font-serif">
                    “{eggData?.hitokoto}”
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <span className="w-6 h-px bg-gray-200"></span>
                    <span>{eggData?.from_who || '佚名'}</span>
                    <span className="font-light italic text-gray-400">《{eggData?.from}》</span>
                    <span className="w-6 h-px bg-gray-200"></span>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-center text-[10px] text-gray-300 mt-6">
              Organized by Study Room Booker
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default HistoryList;