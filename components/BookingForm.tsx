import React, { useState, useRef, useEffect, useMemo } from 'react';
import { addDays, format } from 'date-fns';
import {zhCN} from 'date-fns/locale/zh-CN';
import { Loader2, Plus, Clock, User, Crown, Users, PartyPopper } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { TIME_SLOTS, MEMBER_LIST, Booking, MAX_CAPACITY, EXAM_END_DATE, CELEBRATION_MESSAGE } from '../types';

interface BookingFormProps {
  onSuccess: () => void;
  existingBookings: Booking[]; // Receive existing bookings to check availability
}

// ----------------------------------------------------------------------
// 内部组件：带自动补全的输入框
// ----------------------------------------------------------------------
interface AutoCompleteInputProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  required?: boolean;
}

const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({ 
  label, icon, value, onChange, placeholder, required 
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 过滤名单
  const suggestions = MEMBER_LIST.filter(name => 
    name.includes(value) && name !== value
  );

  // 点击外部关闭建议列表
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
        {icon}
        {label}
        {required && <span className="text-xs text-red-400">*必填</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
        />
        {/* 如果有匹配项且输入框有焦点，显示列表 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
            {suggestions.map((name) => (
              <div
                key={name}
                className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0"
                onClick={() => {
                  onChange(name);
                  setShowSuggestions(false);
                }}
              >
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  {name[0]}
                </div>
                {name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------------

const BookingForm: React.FC<BookingFormProps> = ({ onSuccess, existingBookings }) => {
  // Default to day after tomorrow
  const defaultDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  
  const [date, setDate] = useState(defaultDate);
  const [role, setRole] = useState<'leader' | 'member'>('member'); // 默认为组员，防止大家乱抢队长
  const [name, setName] = useState('');
  
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 庆祝彩蛋状态
  const [showCelebration, setShowCelebration] = useState(false);

  // 计算当前日期每个时间段的状态
  const slotStatus = useMemo(() => {
    const todayBookings = existingBookings.filter(b => b.date === date);
    const status = new Map<string, { count: number, hasLeader: boolean }>();

    // 初始化
    TIME_SLOTS.forEach(t => status.set(t, { count: 0, hasLeader: false }));

    todayBookings.forEach(b => {
      const bookedSlots = b.slot.split(',').map(s => s.trim());
      // members字段现在存的是身份角色: "leader" 或 "member"
      const isLeader = b.members === 'leader';
      
      bookedSlots.forEach(s => {
        const current = status.get(s) || { count: 0, hasLeader: false };
        status.set(s, {
          count: current.count + 1,
          hasLeader: current.hasLeader || isLeader
        });
      });
    });
    return status;
  }, [date, existingBookings]);

  const toggleSlot = (slot: string) => {
    const currentStatus = slotStatus.get(slot);
    if (!currentStatus) return;

    // 1. 检查总容量
    if (currentStatus.count >= MAX_CAPACITY) return;

    // 2. 检查队长冲突
    
    // 3. 单选逻辑
    setSelectedSlots(prev => 
      prev.includes(slot) ? [] : [slot]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. 校验时间段
    if (selectedSlots.length === 0) {
      setError("请至少选择一个时间段");
      return;
    }

    // 2. 校验名字
    if (!name.trim()) {
      setError("请填写你的姓名");
      return;
    }

    // 3. 循环检查每个时间段的逻辑
    for (const slot of selectedSlots) {
      const currentStatus = slotStatus.get(slot);
      if (!currentStatus) continue;

      // 容量检查 (Double Check)
      if (currentStatus.count >= MAX_CAPACITY) {
        setError(`手慢了！时间段 ${slot} 刚刚已满员，请刷新重试`);
        return;
      }

      // 队长唯一性检查
      if (role === 'leader' && currentStatus.hasLeader) {
        setError(`时间段 ${slot} 已经有队长了，请改为选择“我是随行/组员”`);
        return;
      }
    }

    // 4. 校验连续队长逻辑 (新)
    if (role === 'leader') {
      // 4a. 获取该用户当天已有的队长预约
      const existingLeaderSlots = existingBookings
        .filter(b =>
          b.date === date &&
          b.leader === name.trim() &&
          b.members === 'leader'
        )
        .flatMap(b => b.slot.split(',').map(s => s.trim()));

      // 4b. 合并当前选中的时间段
      const allProjectedLeaderSlots = [...new Set([...existingLeaderSlots, ...selectedSlots])];

      // 4c. 转换为索引并排序
      const indices = allProjectedLeaderSlots
        .map(slot => TIME_SLOTS.indexOf(slot))
        .filter(idx => idx !== -1)
        .sort((a, b) => a - b);

      // 4d. 检查是否有连续索引 (例如 0和1, 或者 1和2)
      for (let i = 0; i < indices.length - 1; i++) {
        if (indices[i + 1] === indices[i] + 1) {
          setError("注意！同一天不能连续两个时间段担任队长哦！");
          return;
        }
      }
    }

    // 5. 查重逻辑
    const isDuplicate = existingBookings.some(b => {
      if (b.date !== date) return false;
      if (b.leader !== name.trim()) return false; 
      
      const bookedSlots = b.slot.split(',').map(s => s.trim());
      return bookedSlots.some(s => selectedSlots.includes(s));
    });

    if (isDuplicate) {
      setError("你已经在这个时间段预约过了，请不要重复提交");
      return;
    }

    setIsSubmitting(true);

    try {
      const sortedSlots = [...selectedSlots].sort();
      const slotString = sortedSlots.join(', ');

      const { error: supabaseError } = await supabase
        .from('bookings')
        .insert([
          {
            date,
            leader: name.trim(), // 存名字
            members: role,       // 存身份 "leader" | "member"
            slot: slotString,
          },
        ]);

      if (supabaseError) throw supabaseError;

      // Reset form logic
      setName('');
      setSelectedSlots([]);
      setRole('member'); 
      
      // 触发数据更新
      onSuccess();

      // 🎉 检查是否触发彩蛋
      if (date === EXAM_END_DATE) {
        setShowCelebration(true);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "预约失败，请检查网络或重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayDate = date ? format(new Date(date), 'M月d日 EEEE', { locale: zhCN }) : '';

  return (
    <>
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 relative overflow-hidden h-fit">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
      <h2 className="text-gray-900 font-semibold text-lg mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 text-indigo-600" />
        新增预约
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex justify-between items-center">
            <span>日期</span>
            <span className="text-gray-400 font-normal text-xs">{displayDate}</span>
          </label>
          <div className="relative">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedSlots([]); 
              }}
              className="block w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none appearance-none"
            />
          </div>
        </div>

        {/* Role Selection (New) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            预约身份
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('leader')}
              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                role === 'leader'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
              }`}
            >
              <Crown className={`w-6 h-6 mb-1 ${role === 'leader' ? 'fill-current' : ''}`} />
              <span className="text-sm font-bold">我是队长</span>
              <span className="text-[10px] opacity-70">负责带队/主预约</span>
              {role === 'leader' && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full"></div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setRole('member')}
              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                role === 'member'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
              }`}
            >
              <Users className="w-6 h-6 mb-1" />
              <span className="text-sm font-bold">我是随行/组员</span>
              <span className="text-[10px] opacity-70">加入已有的车队</span>
              {role === 'member' && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </button>
          </div>
        </div>

        {/* Name Input */}
        <AutoCompleteInput 
          label="姓名"
          icon={<User className="w-4 h-4 text-gray-400" />}
          value={name}
          onChange={setName}
          placeholder="请输入你的名字"
          required
        />

        {/* Time Slots */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <Clock className="w-4 h-4 text-gray-400" />
            选择时间段 <span className="text-xs text-gray-400 font-normal">(每次仅限选一个)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_SLOTS.map((slot) => {
              const status = slotStatus.get(slot) || { count: 0, hasLeader: false };
              const isFull = status.count >= MAX_CAPACITY;
              const isSelected = selectedSlots.includes(slot);
              const remaining = Math.max(0, MAX_CAPACITY - status.count);
              
              const isLeaderConflict = role === 'leader' && status.hasLeader;
              
              let btnClass = "border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-gray-50 bg-white";
              
              if (isFull) {
                btnClass = "bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed line-through opacity-70";
              } else if (isSelected) {
                if (isLeaderConflict) {
                    btnClass = "bg-amber-500 text-white border-amber-500 shadow-md transform scale-105";
                } else {
                    btnClass = "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105";
                }
              }

              return (
                <button
                  key={slot}
                  type="button"
                  disabled={isFull}
                  onClick={() => toggleSlot(slot)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border flex items-center gap-1 ${btnClass}`}
                >
                  <span>{slot}</span>
                  {!isFull && !isSelected && (
                     <span className={`text-[10px] px-1 rounded-sm ${status.hasLeader ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                       {status.hasLeader ? '已有队长' : '缺队长'}
                     </span>
                  )}
                  {!isFull && !isSelected && (
                     <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded-sm">余{remaining}</span>
                  )}
                  {isFull && <span className="text-[10px] ml-1">满</span>}
                </button>
              );
            })}
          </div>
          {role === 'leader' && selectedSlots.some(s => slotStatus.get(s)?.hasLeader) && (
              <p className="text-xs text-amber-600 mt-2">⚠️ 注意：你选择了“我是队长”，但部分选中时间段已经有队长了。请修改身份。</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2 animate-pulse">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-gray-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              占座中...
            </>
          ) : (
            '确认预约'
          )}
        </button>
      </form>
    </div>

    {/* 🎉 Celebration Modal (No Blur, Transparent Overlay) */}
    {showCelebration && (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/5 animate-in fade-in duration-300"
        onClick={() => setShowCelebration(false)}
      >
        <div 
          className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-gray-100 text-center transform animate-in zoom-in-95 duration-200 relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Decorative Sparkles */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-80"></div>
          
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-50 p-3 rounded-full">
                <PartyPopper className="w-8 h-8 text-indigo-600 animate-bounce" />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">
            期末就要结束啦！
          </h3>
          
          <p className="text-gray-600 font-medium mb-6 leading-relaxed">
            {CELEBRATION_MESSAGE}
          </p>

          <button 
            onClick={() => setShowCelebration(false)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-200"
          >
            好耶！
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default BookingForm;