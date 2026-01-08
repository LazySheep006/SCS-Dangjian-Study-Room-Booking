import React, { useEffect, useState, useCallback } from 'react';
import { supabase, isDemoMode } from './services/supabaseClient';
import { Booking } from './types';
import StatusCard from './components/StatusCard';
import BookingForm from './components/BookingForm';
import HistoryList from './components/HistoryList';
import { GraduationCap, WifiOff, Cloud } from 'lucide-react';

const App: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: false }); // Latest dates first

      if (error) {
        // Log the full error message for debugging
        console.error('Error fetching bookings:', error.message || error);
      } else {
        setBookings(data || []);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return (
    <div className="min-h-screen bg-gray-50 sm:py-8 flex justify-center font-sans text-gray-800">
      {/* 
         Layout Container:
         - Mobile: w-full max-w-md (classic mobile view)
         - Desktop (md+): max-w-6xl (wider view for dual columns)
      */}
      <div className="w-full md:max-w-6xl bg-white min-h-screen sm:min-h-fit sm:rounded-[2rem] shadow-xl overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Header - Full Width */}
        <header className={`p-6 pb-8 transition-colors ${isDemoMode ? 'bg-gray-800' : 'bg-gradient-to-br from-indigo-700 to-blue-600' } text-white`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">组织部期末自习室</h1>
              </div>
              <p className="text-blue-100 text-sm opacity-90 pl-1">
                好好学习，天天向上。记得提前抢座！
              </p>
            </div>

            {/* Status Badge */}
            <div className={`self-start md:self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isDemoMode 
                ? 'bg-amber-400/20 border-amber-400/30 text-amber-200' 
                : 'bg-green-400/20 border-green-400/30 text-green-100'
            }`}>
              {isDemoMode ? (
                <>
                  <WifiOff className="w-3 h-3" />
                  本地演示模式 (数据仅本机可见)
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3" />
                  云端数据已同步
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 -mt-4 pb-10">
          
          {/* 
             Grid Layout:
             - Mobile: Single column (block)
             - Desktop: 2 Columns (Left: Status+Form, Right: History)
          */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
            
            {/* Left Column (Main Actions) - Spans 7 cols on desktop */}
            <div className="md:col-span-7 lg:col-span-7 space-y-6">
              {/* Status Alert Card */}
              <StatusCard bookings={bookings} />

              {/* New Booking Form - Pass bookings for validation */}
              <BookingForm onSuccess={fetchBookings} existingBookings={bookings} />
            </div>

            {/* Right Column (History) - Spans 5 cols on desktop */}
            <div className="md:col-span-5 lg:col-span-5">
              <div className="md:sticky md:top-6">
                 {/* Remove negative margin to prevent header overlap */}
                 <div>
                   <HistoryList bookings={bookings} loading={loading} />
                 </div>
              </div>
            </div>

          </div>
          
        </main>
        
        <footer className="py-6 text-center text-xs text-gray-400 bg-gray-50 border-t border-gray-100 mt-auto">
          <p>© 2026 组织部 · Study Hard</p>
        </footer>
      </div>
    </div>
  );
};

export default App;