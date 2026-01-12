export interface Booking {
  id: number;
  created_at: string;
  date: string; // YYYY-MM-DD format
  slot: string; // Comma separated string or specific text
  leader: string; // 实际存的是：预约人姓名 (Name)
  members: string; // 实际存的是：身份角色 ("leader" | "member")
}

export const TIME_SLOTS = [
  "9:00-13:00",
  "14:00-18:00",
  "19:00-22:30"
];

// 每个时间段的最大容量
export const MAX_CAPACITY = 3;

// 组织部成员名单
export const MEMBER_LIST = [
  "董砥江",
  "汪诗萱",
  "沈幸妤",
  "王易然",
  "于绍礼",
  "吴恒涛",
  "吴嘉迪",
  "陈熙",
  "郭航宁",
  "许哲文",
  "穆蓝",
  "任博轩",
  "郭家玮"
];

// 设置期末考试结束的日期 (YYYY-MM-DD)
// 当用户预约这一天的座位时，提交成功后会弹出庆祝彩蛋
export const EXAM_END_DATE = "2026-01-12";

// 庆祝弹窗显示的祝福语
export const CELEBRATION_MESSAGE = "恭喜大家考完熬过期末粥！";