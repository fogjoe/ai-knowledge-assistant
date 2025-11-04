// app/page.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex h-screen bg-gray-50">

      {/* 左侧栏：文档管理区 */}
      <aside className="w-72 border-r bg-white p-4 shadow-md">
        <h2 className="text-xl font-bold mb-4">知识库管理</h2>

        {/* 文件上传区域 (UI 原型) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>上传文档</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 提示用户可以拖拽上传，这里先用 Input 占位 */}
            <Input type="file" id="file-upload" accept=".pdf,.txt,.md" />
            <Button className="w-full mt-3">开始处理 (后端还未连接)</Button>
          </CardContent>
        </Card>

        {/* 文档列表 (Mock 数据) */}
        <div className="space-y-2">
          <div className="p-2 border rounded cursor-pointer hover:bg-gray-100">
            ✅ 2024 产品手册.pdf
          </div>
          <div className="p-2 border rounded cursor-pointer hover:bg-gray-100">
            ✅ 售后支持文档.txt
          </div>
          <div className="p-2 border rounded cursor-pointer bg-blue-50 text-blue-700">
            💬 与《产品手册》对话
          </div>
        </div>
      </aside>

      {/* 右侧：聊天主界面 */}
      <main className="flex-1 flex flex-col">
        {/* 聊天历史区 */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
          {/* 这里未来会渲染聊天消息 */}
          <p className="text-center text-gray-500 mt-10">欢迎使用 AI 知识库助手，请选择左侧文档开始提问。</p>
        </div>

        {/* 输入区 */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <Input placeholder="输入您的问题..." className="flex-1" />
            <Button>发送</Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">当前对话基于：2024 产品手册.pdf</p>
        </div>
      </main>

    </div>
  );
}