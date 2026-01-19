"""
✅ ИСПРАВЛЕНИЕ СП-5: Пагинация для API endpoints
"""
from typing import Any, List
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from core.utils.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE


class StandardResultsSetPagination(PageNumberPagination):
    """
    Стандартная пагинация для всех API endpoints
    
    Usage:
        class MyAPIView(APIView):
            pagination_class = StandardResultsSetPagination
            
            def get(self, request):
                queryset = MyModel.objects.all()
                paginator = self.pagination_class()
                page = paginator.paginate_queryset(queryset, request)
                
                if page is not None:
                    serializer = MySerializer(page, many=True)
                    return paginator.get_paginated_response(serializer.data)
                
                serializer = MySerializer(queryset, many=True)
                return Response(serializer.data)
    """
    page_size = DEFAULT_PAGE_SIZE
    page_size_query_param = 'page_size'
    max_page_size = MAX_PAGE_SIZE
    page_query_param = 'page'
    
    def get_paginated_response(self, data: List[Any]) -> Response:  # type: ignore[override]
        if self.page is None:
            # Fallback если page не установлен
            return Response({
                'count': 0,
                'next': None,
                'previous': None,
                'total_pages': 0,
                'current_page': 1,
                'page_size': self.page_size,
                'results': data
            })
        
        return Response({
            'count': self.page.paginator.count,  # type: ignore[attr-defined]
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'total_pages': self.page.paginator.num_pages,  # type: ignore[attr-defined]
            'current_page': self.page.number,  # type: ignore[attr-defined]
            'page_size': self.page_size,
            'results': data
        })


class LargeResultsSetPagination(PageNumberPagination):
    """Пагинация для больших датасетов"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class SmallResultsSetPagination(PageNumberPagination):
    """Пагинация для маленьких датасетов"""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50

