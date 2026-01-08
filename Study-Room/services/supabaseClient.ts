import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// 🔧 配置区域
// ------------------------------------------------------------------

// 1. Project URL (项目网址)
const SUPABASE_URL = 'https://lkgpvecudmsyredzouvt.supabase.co'; 

// 2. API Key (公钥)
const SUPABASE_KEY = 'sb_publishable_SvQMdeRlEPuYAIl_joI42g_zdTteyDv';

// ------------------------------------------------------------------

// 检查配置是否有效
const isDefaultConfig = 
  !SUPABASE_URL || 
  !SUPABASE_URL.startsWith('http') ||
  !SUPABASE_KEY;

let client;

if (!isDefaultConfig) {
  // ✅ 生产模式：连接真实数据库
  client = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  // ⚠️ 演示模式：配置无效或未填写，使用本地模拟数据
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ Supabase 配置无效，启用本地演示模式 (Demo Mode)');
  }
  
  // 创建一个模拟的 Supabase 客户端
  client = {
    _isDemo: true, // 标记位，用于 UI 显示
    from: (table: string) => {
      const getStorage = () => {
        try {
          return JSON.parse(localStorage.getItem(`demo_${table}`) || '[]');
        } catch { return []; }
      };
      const setStorage = (data: any[]) => localStorage.setItem(`demo_${table}`, JSON.stringify(data));

      return {
        select: () => ({
          order: async (col: string, { ascending = true } = {}) => {
            await new Promise(r => setTimeout(r, 500)); // 模拟网络延迟
            const data = getStorage();
            data.sort((a: any, b: any) => {
              if (a[col] < b[col]) return ascending ? -1 : 1;
              if (a[col] > b[col]) return ascending ? 1 : -1;
              return 0;
            });
            return { data, error: null };
          }
        }),
        insert: async (rows: any[]) => {
          await new Promise(r => setTimeout(r, 500));
          const current = getStorage();
          const newRows = rows.map((r, i) => ({
            id: Date.now() + i,
            created_at: new Date().toISOString(),
            ...r
          }));
          setStorage([...current, ...newRows]);
          return { data: newRows, error: null };
        }
      };
    }
  };
}

export const supabase = client as any;
export const isDemoMode = (client as any)._isDemo || false;