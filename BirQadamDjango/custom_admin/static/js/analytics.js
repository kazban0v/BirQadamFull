// custom_admin/static/js/analytics.js

// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', function() {

    // Функция создания графиков
    function createChart(elementId, chartData) {
        const ctx = document.getElementById(elementId);
        if (!ctx) {
            console.error('Canvas element not found:', elementId);
            return;
        }

        try {
            new Chart(ctx, {
                type: 'bar', // Можно изменить на 'pie' или 'doughnut'
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: chartData.title,
                        data: chartData.values,
                        backgroundColor: chartData.colors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: chartData.labels.length > 1 // Показывать легенду если больше 1 элемента
                        },
                        title: {
                            display: true,
                            text: chartData.title,
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                precision: 0
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Chart creation error:', e);
        }
    }

    // Загрузка данных с сервера
    fetch('/custom-admin/analytics/')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('Analytics data received:', data);

            // График для проектов
            if (data.project_data && data.project_data.length) {
                createChart('projectChart', {
                    title: 'Projects Status',
                    labels: data.project_data.map(item => item.status.toUpperCase()),
                    values: data.project_data.map(item => item.count),
                    colors: ['#4e73df', '#1cc88a', '#e74a3b'] // Синий, зеленый, красный
                });
            } else {
                console.warn('No project data received');
            }

            // График для задач
            if (data.task_data && data.task_data.length) {
                createChart('taskChart', {
                    title: 'Tasks Status',
                    labels: data.task_data.map(item => item.status.toUpperCase()),
                    values: data.task_data.map(item => item.count),
                    colors: ['#36b9cc', '#f6c23e', '#858796'] // Голубой, желтый, серый
                });
            } else {
                console.warn('No task data received');
            }
        })
        .catch(error => {
            console.error('Failed to load analytics:', error);
            // Можно показать сообщение об ошибке пользователю
            document.getElementById('projectChart').closest('.card').innerHTML =
                '<div class="alert alert-danger">Error loading project data</div>';
            document.getElementById('taskChart').closest('.card').innerHTML =
                '<div class="alert alert-danger">Error loading task data</div>';
        });
});