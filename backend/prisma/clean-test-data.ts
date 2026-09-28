/**
 * Script idempotente para limpar dados de teste do onboarding.
 * Remove Articles, SourceTopics, DailyRecommendations, ReadingHistory,
 * UserPreferences e Sources criadas durante testes.
 * Preserva Users, Topics, Categories e Sources seed (Simon Willison, etc).
 *
 * Uso: npx tsx prisma/clean-test-data.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// URLs dos sources criados pelo seed (não removidos)
const SEED_SOURCE_URLS = new Set([
  'https://simonwillison.net',
  'https://huggingface.co/blog',
  'https://magazine.sebastianraschka.com',
  'https://www.deeplearning.ai/the-batch/',
  'https://martinfowler.com',
  'https://www.infoq.com',
  'https://www.latent.space',
  'https://aeon.co'
])

async function main() {
  console.log('🧹 Limpando dados de teste...')

  // Articles criados durante testes (tudo, já que onboarding gera artigos novos)
  const deletedArticles = await prisma.article.deleteMany({})
  console.log(`🗑️  Articles removidos: ${deletedArticles.count}`)

  // SourceTopic (vinculações)
  const deletedSourceTopics = await prisma.sourceTopic.deleteMany({})
  console.log(`🗑️  SourceTopics removidos: ${deletedSourceTopics.count}`)

  // DailyRecommendations do usuário de teste
  const deletedRecs = await prisma.dailyRecommendation.deleteMany({})
  console.log(`🗑️  DailyRecommendations removidos: ${deletedRecs.count}`)

  // ReadingHistory
  const deletedHistory = await prisma.readingHistory.deleteMany({})
  console.log(`🗑️  ReadingHistory removido: ${deletedHistory.count}`)

  // UserPreferences
  const deletedPrefs = await prisma.userPreference.deleteMany({})
  console.log(`🗑️  UserPreferences removidos: ${deletedPrefs.count}`)

  // Sources não-seed (criadas via discovery durante onboarding)
  const deletedSources = await prisma.source.deleteMany({
    where: { url: { notIn: Array.from(SEED_SOURCE_URLS) } }
  })
  console.log(`🗑️  Sources removidos (não-seed): ${deletedSources.count}`)

  // Reseta onboardingCompleted de todos os usuários para permitir re-teste
  const updatedUsers = await prisma.user.updateMany({
    where: { onboardingCompleted: true },
    data: { onboardingCompleted: false }
  })
  console.log(`🔄 Usuários com onboarding resetado: ${updatedUsers.count}`)

  // Limpa RefreshTokens revogados antigos (não ativos)
  const deletedTokens = await prisma.refreshToken.deleteMany({
    where: { revokedAt: { not: null } }
  })
  console.log(`🗑️  RefreshTokens revogados removidos: ${deletedTokens.count}`)

  console.log('✅ Limpeza concluída!')
}

main()
  .catch((e) => {
    console.error('❌ Erro durante limpeza:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
