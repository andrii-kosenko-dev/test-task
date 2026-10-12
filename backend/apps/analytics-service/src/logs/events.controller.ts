import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiExcludeController } from '@nestjs/swagger';
import { EVENT_PATTERN, isAppEvent } from '@app/common';
import { LogsRepository } from './logs.repository';

/** Redis transporter subscriber: every event published by other services becomes a log. */
@ApiExcludeController()
@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly logs: LogsRepository) {}

  @EventPattern(EVENT_PATTERN)
  async onEvent(@Payload() message: unknown): Promise<void> {
    if (!isAppEvent(message)) {
      console.warn('[events] dropped malformed event');
      return;
    }
    await this.logs.insert(message);
    this.logger.debug(`stored ${message.type} from ${message.service}`);
  }
}
