import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NewsService, type NewsCategory } from './news.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const VALID_CATEGORIES: NewsCategory[] = ['press_release', 'updates', 'case_law'];

@UseGuards(JwtAuthGuard)
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async list(
    @Query('category') category?: string,
    @Query('refresh') refresh?: string,
  ) {
    const items = await this.news.fetchAll({ force: refresh === '1' });
    if (category && VALID_CATEGORIES.includes(category as NewsCategory)) {
      return items.filter((i) => i.category === (category as NewsCategory));
    }
    return items;
  }

  @Get('sources')
  sources() {
    return this.news.status();
  }
}
