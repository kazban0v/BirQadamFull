<template>
  <section class="not-found d-flex align-center justify-center">
    <v-container>
      <v-row class="justify-center">
        <v-col cols="12" md="8" lg="6">
          <v-card class="pa-10 text-center">
            <v-avatar size="80" color="primary" class="mb-6">
              <v-icon icon="mdi-compass-off-outline" size="40" />
            </v-avatar>
            <h1 class="text-h4 font-weight-bold mb-4">Страница не найдена</h1>
            <p class="text-body-1 mb-8">
              Возможно, ссылка устарела или страница была перемещена. Вернитесь на главную или выберите другой раздел.
            </p>
            <v-btn color="primary" class="text-none" to="/">На главную</v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.not-found {
  min-height: calc(100vh - 160px);
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.12), rgba(227, 121, 77, 0.08)); /* BirQadam colors */
}
</style>

