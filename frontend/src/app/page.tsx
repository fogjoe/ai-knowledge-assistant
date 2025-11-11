'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState } from 'react'

interface UploadedDocument {
  id: number
  file_name: string
  storage_path: string
  status: 'PENDING' | 'UPLOADED' | 'PROCESSING' | 'DONE'
  created_at: string
}

interface Message {
  id: number
  sender: 'user' | 'ai'
  text: string
  sources?: any[] // 用于存储 AI 回复的来源
}

export default function HomePage() {
  // 1. 跟踪用户选择的文件
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  // 2. 跟踪上传状态
  const [uploadStatus, setUploadStatus] = useState<string>('')
  // 3. (可选) 跟踪文档列表
  const [documents, setDocuments] = useState<UploadedDocument[]>([]) // 暂时用 any

  // --- P4 的 State ---
  const [messages, setMessages] = useState<Message[]>([])
  const [currentQuery, setCurrentQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

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
      const response = await fetch('http://127.0.0.1:5050/api/documents/upload', {
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

  // --- P4 的核心函数 ---
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentQuery || isLoading) return

    setIsLoading(true)
    const userMessage: Message = {
      id: Date.now(),
      sender: 'user',
      text: currentQuery
    }
    setMessages(prev => [...prev, userMessage])
    setCurrentQuery('')

    try {
      // 调用 P4 后端 API
      const response = await fetch('http://127.0.0.1:5050/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.text })
      })

      if (!response.ok) {
        throw new Error('AI 响应失败')
      }

      const aiData = await response.json()

      const aiMessage: Message = {
        id: Date.now() + 1,
        sender: 'ai',
        text: aiData.answer,
        sources: aiData.sourceDocuments
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        sender: 'ai',
        text: `抱歉，处理您的请求时出错: ${error.message}`
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
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

        <h3 className="text-lg font-semibold mb-2">已上传文档</h3>
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="p-2 border rounded cursor-pointer hover:bg-gray-100 text-sm">
                ✅ {doc.file_name}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* 右侧：聊天主界面 (更新) */}
      <main className="flex-1 flex flex-col h-screen">
        {/* 聊天历史区 */}
        <ScrollArea className="flex-1 p-6 bg-gray-100">
          <div className="space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-black shadow-sm'}`}>
                  <p>{msg.text}</p>
                  {/* (可选) 显示 AI 回复的来源 */}
                  {msg.sender === 'ai' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <h4 className="text-xs font-bold mb-1">参考来源:</h4>
                      <ul className="list-disc pl-4">
                        {msg.sources.map((src, index) => (
                          <li key={index} className="text-xs truncate" title={src.contentPreview}>
                            {src.source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-white text-black shadow-sm">
                  <p>AI 正在思考中...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 输入区 */}
        <div className="p-4 border-t bg-white">
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <Input placeholder="基于您上传的文档提问..." className="flex-1" value={currentQuery} onChange={e => setCurrentQuery(e.target.value)} disabled={isLoading} />
            <Button type="submit" disabled={isLoading || !currentQuery}>
              {isLoading ? '发送中...' : '发送'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
