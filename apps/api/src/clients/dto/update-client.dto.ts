import { PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

// Every field optional — only what changed is sent. Same validation rules
// as create apply to whichever fields are present.
export class UpdateClientDto extends PartialType(CreateClientDto) {}
