'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'

interface UploadedDocument {
  id: number
  file_name: string
  storage_path: string
  status: 'PENDING' | 'UPLOADED' | 'PROCESSING' | 'DONE'
  created_at: string
}

export default function HomePage() {
  // 1. 跟踪用户选择的文件
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  // 2. 跟踪上传状态
  const [uploadStatus, setUploadStatus] = useState<string>('')
  // 3. (可选) 跟踪文档列表
  const [documents, setDocuments] = useState<UploadedDocument[]>([]) // 暂时用 any

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0])
      setUploadStatus('') // 重置状态
    }
  }

  // 在 HomePage 组件内部

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('请先选择一个文件。')
      return
    }

    setUploadStatus('上传中...')

    // 1. 创建 FormData
    // FormData 是发送文件到后端的标准方式
    const formData = new FormData()
    // 'file' 必须和 Nest.js 中 FileInterceptor('file') 的参数一致
    formData.append('file', selectedFile)

    try {
      // 2. 调用后端 API
      const response = await fetch('http://localhost:3001/api/documents/upload', {
        method: 'POST',
        body: formData
        // 注意：使用 FormData 时，浏览器会自动设置 Content-Type，
        // 你 *不需要* 手动设置 'Content-Type': 'multipart/form-data'
      })

      if (!response.ok) {
        // 如果服务器返回非 2xx 状态码
        const errorData = await response.json()
        throw new Error(errorData.message || '上传失败')
      }

      // 3. 处理成功响应
      const result = await response.json()
      setUploadStatus('上传成功！')
      setSelectedFile(null) // 清空文件选择

      // (可选) 将新文档添加到列表中
      setDocuments([...documents, result.document])

      console.log('上传结果:', result)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('上传出错:', error)
      setUploadStatus(`上传失败: ${error.message}`)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧栏：文档管理区 */}
      <aside className="w-72 border-r bg-white p-4 shadow-md">
        <h2 className="text-xl font-bold mb-4">知识库管理</h2>

        {/* 文件上传区域 (已连接) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>上传文档</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              id="file-upload"
              accept=".pdf,.txt,.md"
              onChange={handleFileChange} // 👈 绑定文件选择
            />
            <Button
              className="w-full mt-3"
              onClick={handleUpload} // 👈 绑定上传点击事件
              disabled={!selectedFile || uploadStatus === '上传中...'} // 👈 增加禁用状态
            >
              {uploadStatus === '上传中...' ? '处理中...' : '开始处理'}
            </Button>
            {/* 显示上传状态 */}
            {uploadStatus && <p className="mt-2 text-sm text-center text-gray-600">{uploadStatus}</p>}
          </CardContent>
        </Card>

        {/* 文档列表 (Mock 数据) */}
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="p-2 border rounded cursor-pointer hover:bg-gray-100">
              ✅ {doc.file_name}
            </div>
          ))}
          <div className="p-2 border rounded cursor-pointer hover:bg-gray-100">✅ 2024 产品手册.pdf</div>
          <div className="p-2 border rounded cursor-pointer hover:bg-gray-100">✅ 售后支持文档.txt</div>
          <div className="p-2 border rounded cursor-pointer bg-blue-50 text-blue-700">💬 与《产品手册》对话</div>
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
  )
}
