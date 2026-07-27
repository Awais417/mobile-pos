import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

// Every field optional — only what the admin actually changed is sent.
// Same validation rules as create (whole positive amount, ISO date, etc.)
// apply to whichever fields are present.
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
