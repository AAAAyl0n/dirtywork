-- Supabase 数据库设置
-- 在 Supabase 控制台的 SQL Editor 中执行此脚本

-- 创建 project_history 表
CREATE TABLE project_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  type TEXT NOT NULL,           -- 'refine' | 'translate' | 其他工具类型
  title TEXT NOT NULL,          -- AI 生成的标题
  original_text TEXT NOT NULL,  -- 输入文本
  result_text TEXT NOT NULL,    -- 输出结果
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以优化查询
CREATE INDEX idx_project_history_user_id ON project_history(user_id);
CREATE INDEX idx_project_history_created_at ON project_history(created_at DESC);
CREATE INDEX idx_project_history_type ON project_history(type);

-- 启用行级安全 (RLS)
ALTER TABLE project_history ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的记录
CREATE POLICY "Users can view own history" 
  ON project_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS 策略：用户只能插入自己的记录
CREATE POLICY "Users can insert own history" 
  ON project_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户只能更新自己的记录
CREATE POLICY "Users can update own history" 
  ON project_history 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS 策略：用户只能删除自己的记录
CREATE POLICY "Users can delete own history" 
  ON project_history 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 创建 user_api_keys 表
CREATE TABLE user_api_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openrouter_api_key TEXT NOT NULL,
  openrouter_analyze_model TEXT,
  openrouter_summarize_model TEXT,
  openrouter_refine_model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 如果表已经存在，可单独执行下面三句补列
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS openrouter_analyze_model TEXT;
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS openrouter_summarize_model TEXT;
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS openrouter_refine_model TEXT;

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys"
  ON user_api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
  ON user_api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON user_api_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
  ON user_api_keys
  FOR DELETE
  USING (auth.uid() = user_id);
