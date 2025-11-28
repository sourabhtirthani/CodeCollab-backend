import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CodeEditorGateway } from './code-editor/code-editor.gateway';
import { ChatGateway } from './chat/chat.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, CodeEditorGateway, ChatGateway],
})
export class AppModule {}
