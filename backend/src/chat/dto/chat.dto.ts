// 我们需要 class-validator 来验证输入
// 如果没有安装，请运行: npm install class-validator
import { IsString, IsNotEmpty } from 'class-validator';

export class ChatQueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  // (可选) 将来我们可以传入 documentId 来指定在哪个文档中提问
  // @IsNumber()
  // documentId: number;
}
